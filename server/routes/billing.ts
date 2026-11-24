import { Router } from 'express';
import { z } from 'zod';
import {
  calculateDue,
  calculateOrderTotals,
  resolveDiscountAmount,
  roundMinorUnits,
  splitEqually,
} from '../billing.ts';
import { getMaxCashierDiscountPercent } from '../config.ts';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { id, now } from '../http.ts';
import { requirePermission, type AuthRequest } from '../middleware.ts';
import { withBillNumber } from '../numbering.ts';
import { recomputeTableStatus } from '../order-state.ts';
import { closeIfPaid, refreshOrderTotals } from '../order-totals.ts';
import { parse } from '../validate.ts';

export const billingRouter = Router();

type Row = Record<string, any>;

const PAYMENT_METHODS = ['Cash', 'bKash', 'Nagad', 'Card'] as const;

const discountInput = z.object({
  type: z.enum(['none', 'fixed', 'percent']),
  value: z.number().nonnegative().default(0),
});

const splitInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('equal'), parts: z.number().int().min(2).max(100) }),
  z.object({ mode: z.literal('items') }),
]);

const paymentInput = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().positive(),
  reference: z.string().trim().default(''),
  splitId: z.string().trim().optional(),
});

function invoiceSettings(): Row {
  return getDb()
    .prepare(`
      SELECT restaurant_name, phone, email, address, currency_symbol, vat_percent,
        service_charge_percent, invoice_prefix, paper_size, receipt_footer
      FROM settings WHERE id = 1
    `)
    .get() as Row;
}

function billView(orderId: string): Row {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found.');
  const lines = db
    .prepare(`SELECT * FROM order_items WHERE order_id = ? AND status != 'cancelled' ORDER BY created_at`)
    .all(orderId) as Row[];
  const settings = invoiceSettings();
  const totals = calculateOrderTotals(
    lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unit_price })),
    order.discount,
    {
      vatPercent: settings.vat_percent,
      serviceChargePercent: settings.service_charge_percent,
    }
  );
  const payments = db
    .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at')
    .all(orderId) as Row[];
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    order,
    lines,
    totals,
    paid,
    due: calculateDue(totals.total, paid),
    payments,
    splits: db
      .prepare('SELECT * FROM bill_splits WHERE order_id = ? ORDER BY label')
      .all(orderId),
    settings,
  };
}

function assertBillable(orderId: string): Row {
  const order = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status === 'closed' || order.payment_status !== 'unpaid') {
    throw new HttpError(409, 'This bill is already closed or void.');
  }
  return order;
}

billingRouter.get('/orders/:orderId', requirePermission('bills:read'), (req, res) => {
  res.json(billView(req.params.orderId));
});

billingRouter.post('/orders/:orderId/request', requirePermission('bills:request'), (req, res) => {
  const db = getDb();
  const order = assertBillable(req.params.orderId);
  if (!order.bill_number) {
    withBillNumber(db, (billNumber) => {
      db.prepare('UPDATE orders SET bill_number = ? WHERE id = ?').run(billNumber, order.id);
      return billNumber;
    });
    recomputeTableStatus(db, order.table_id);
  }
  res.status(201).json(billView(order.id));
});

billingRouter.post('/orders/:orderId/discount', requirePermission('bills:write'), (req: AuthRequest, res) => {
  const input = parse(discountInput, req.body);
  const db = getDb();
  const order = assertBillable(req.params.orderId);
  const view = billView(order.id);
  const cap = req.auth!.role === 'cashier' ? getMaxCashierDiscountPercent() : 100;
  let amount: number;
  try {
    amount = resolveDiscountAmount(
      view.totals.subtotal,
      { type: input.type, value: input.value },
      cap
    );
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid discount.');
  }
  db.prepare('UPDATE orders SET discount = ? WHERE id = ?').run(amount, order.id);
  refreshOrderTotals(db, order.id);
  res.json(billView(order.id));
});

billingRouter.post('/orders/:orderId/splits', requirePermission('bills:split'), (req, res) => {
  const input = parse(splitInput, req.body);
  const db = getDb();
  const order = assertBillable(req.params.orderId);
  const view = billView(order.id);
  const total = view.totals.total;

  let amounts: number[];
  let labels: string[];
  if (input.mode === 'equal') {
    amounts = splitEqually(total, input.parts);
    labels = amounts.map((_, index) => `Split ${index + 1}`);
  } else {
    const lines = view.lines as Row[];
    const weights = lines.map((line) => line.line_total as number);
    const weightSum = weights.reduce((sum: number, value: number) => sum + value, 0);
    if (weightSum <= 0) throw new HttpError(409, 'The bill has no payable items.');
    amounts = weights.map((weight: number) => roundMinorUnits((total * weight) / weightSum));
    const drift = total - amounts.reduce((sum: number, value: number) => sum + value, 0);
    amounts[amounts.length - 1] += drift;
    labels = lines.map(
      (line: Row, index: number) =>
        line.name_snapshot +
        (line.variant_name_snapshot ? ` (${line.variant_name_snapshot})` : '') +
        ` #${index + 1}`
    );
  }

  db.transaction(() => {
    db.prepare('DELETE FROM bill_splits WHERE order_id = ?').run(order.id);
    const insert = db.prepare(`
      INSERT INTO bill_splits (id, order_id, label, amount)
      VALUES (?, ?, ?, ?)
    `);
    amounts.forEach((amount, index) => {
      insert.run(id('spl'), order.id, labels[index], amount);
    });
  }).immediate();
  res.status(201).json(billView(order.id));
});

billingRouter.post('/orders/:orderId/payments', requirePermission('bills:pay'), (req: AuthRequest, res) => {
  const input = parse(paymentInput, req.body);
  const db = getDb();
  const order = assertBillable(req.params.orderId);
  let split: Row | undefined;
  if (input.splitId) {
    split = db
      .prepare('SELECT * FROM bill_splits WHERE id = ? AND order_id = ?')
      .get(input.splitId, order.id) as Row | undefined;
    if (!split) throw new HttpError(400, 'Unknown splitId for that bill.');
    if (input.amount !== split.amount) {
      throw new HttpError(400, 'Payment amount must match the split amount.');
    }
  }

  const paymentId = id('pay');
  db.transaction(() => {
    db.prepare(`
      INSERT INTO payments (id, order_id, method, amount, reference, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, order.id, input.method, input.amount, input.reference, req.auth!.userId, now());
    db.prepare('UPDATE orders SET payment_method = ? WHERE id = ?').run(input.method, order.id);
    if (split) {
      db.prepare('UPDATE bill_splits SET method = ?, reference = ?, paid_at = ? WHERE id = ?').run(
        input.method,
        input.reference,
        now(),
        split.id
      );
    }
    closeIfPaid(db, order.id);
  }).immediate();
  res.status(201).json(billView(order.id));
});

billingRouter.post('/orders/:orderId/close', requirePermission('bills:pay'), (req, res) => {
  const db = getDb();
  const order = assertBillable(req.params.orderId);
  if (!closeIfPaid(db, order.id)) {
    throw new HttpError(409, 'Payments do not cover the bill total.');
  }
  res.json(billView(order.id));
});

billingRouter.post('/orders/:orderId/void', requirePermission('bills:void'), (req, res) => {
  const db = getDb();
  const order = assertBillable(req.params.orderId);
  db.transaction(() => {
    db.prepare("UPDATE orders SET payment_status = 'void', status = 'closed', closed_at = ? WHERE id = ?").run(
      now(),
      order.id
    );
    recomputeTableStatus(db, order.table_id);
  }).immediate();
  res.json(billView(order.id));
});

billingRouter.get('/orders/:orderId/invoice', requirePermission('bills:read'), (req, res) => {
  const view = billView(req.params.orderId);
  res.json({ invoiceNumber: view.order.bill_number, issuedAt: now(), ...view });
});
