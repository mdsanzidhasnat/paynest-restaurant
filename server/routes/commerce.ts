import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { calculateSubtotal, calculateTaxable, calculateTotal } from '../../src/utils/billing.ts';
import { getDb } from '../db.ts';
import { mapPurchase, mapSale } from '../mappers.ts';
import { requirePermission } from '../middleware.ts';
import { HttpError } from '../errors.ts';
import { parse } from '../validate.ts';

export const salesRouter = Router();
export const purchasesRouter = Router();

const saleColumns =
  'id, invoice_number, customer_id, customer_name, subtotal, discount, vat, amount, profit, payment_status, payment_method, sale_time, sale_date';
const saleItemColumns = 'product_id, name, quantity, unit_price, cost_price';

/** One query for all invoice lines, grouped in memory (no per-sale query). */
function itemsBySale(ids: string[]): Map<string, Record<string, any>[]> {
  const grouped = new Map<string, Record<string, any>[]>();
  if (ids.length === 0) return grouped;
  const placeholders = ids.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(
      `SELECT sale_id, ${saleItemColumns} FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY sale_id, id`
    )
    .all(...ids) as (Record<string, any> & { sale_id: string })[];
  for (const row of rows) {
    const items = grouped.get(row.sale_id) ?? [];
    items.push(row);
    grouped.set(row.sale_id, items);
  }
  return grouped;
}

const saleInput = z.object({
  customerId: z.string().trim().min(1),
  customerName: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  discount: z.number().nonnegative().default(0),
  vat: z.number().nonnegative().default(0),
  paymentMethod: z.enum(['Cash', 'bKash', 'Nagad', 'Card', 'Due']),
});

function getSale(id: string) {
  const row = getDb().prepare(`SELECT ${saleColumns} FROM sales WHERE id = ?`).get(id) as
    | Record<string, any>
    | undefined;
  if (!row) return undefined;
  return mapSale(row, itemsBySale([id]).get(id) ?? []);
}

function nextNumber(statement: 'invoice' | 'purchase', fallback: number): number {
  // Table/column names cannot be bound as parameters, so each statement is a
  // fixed, hard-coded SQL string. Only the returned values are user-influenced.
  const sql =
    statement === 'invoice'
      ? 'SELECT invoice_number AS value FROM sales ORDER BY created_at DESC LIMIT 1'
      : 'SELECT po_number AS value FROM purchases ORDER BY created_at DESC LIMIT 1';
  const row = getDb().prepare(sql).get() as { value: string } | undefined;
  const current = row ? Number(String(row.value).replace(/\D/g, '')) : 0;
  return Number.isFinite(current) && current > 0 ? current + 1 : fallback;
}

salesRouter.get('/', requirePermission('sales:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${saleColumns} FROM sales ORDER BY created_at DESC`).all() as Record<string, any>[];
  const items = itemsBySale(rows.map((row) => row.id as string));
  const sales = rows.map((row) => mapSale(row, items.get(row.id as string) ?? []));
  res.json(sales);
});

salesRouter.post('/', requirePermission('sales:create'), (req, res) => {
  const input = parse(saleInput, req.body);
  const db = getDb();

  // Fetch every product for this sale in one query, then validate in the
  // original item order so error messages stay identical.
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const productPlaceholders = productIds.map(() => '?').join(', ');
  const productRows = db
    .prepare(
      `SELECT id, name, sell_price, cost_price, stock FROM products WHERE id IN (${productPlaceholders})`
    )
    .all(...productIds) as Record<string, any>[];
  const productsById = new Map(productRows.map((product) => [product.id as string, product]));
  const pricedItems = input.items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) throw new HttpError(400, `Unknown product: ${item.productId}`);
    if (product.stock < item.quantity) throw new HttpError(400, `Insufficient stock for ${product.name}.`);
    return { product, quantity: item.quantity };
  });

  const customer =
    input.customerId !== 'walk-in'
      ? (db.prepare('SELECT id, name, due_balance FROM customers WHERE id = ?').get(input.customerId) as
          | Record<string, any>
          | undefined)
      : undefined;
  if (input.customerId !== 'walk-in' && !customer) {
    throw new HttpError(404, 'Customer not found.');
  }

  const subtotal = calculateSubtotal(
    pricedItems.map((line) => ({
      product: { sellPrice: line.product.sell_price },
      quantity: line.quantity,
    }))
  );
  const totalCost = pricedItems.reduce((sum, line) => sum + line.product.cost_price * line.quantity, 0);
  const taxable = calculateTaxable(subtotal, input.discount);
  const amount = calculateTotal(taxable, input.vat);
  const profit = Math.max(taxable - totalCost, 0);
  const paymentStatus = input.paymentMethod === 'Due' ? 'Due' : 'Paid';

  const now = new Date();
  const displayDate = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const displayTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const isoDate = now.toISOString().slice(0, 10);
  const id = `inv-${randomUUID()}`;
  const invoiceNumber = `#INV-${nextNumber('invoice', 2649)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sales (
        id, invoice_number, customer_id, customer_name, subtotal, discount, vat,
        amount, profit, payment_status, payment_method, sale_time, sale_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      invoiceNumber,
      customer?.id ?? null,
      customer?.name ?? input.customerName ?? 'Counter Walk-in Customer',
      subtotal,
      input.discount,
      input.vat,
      amount,
      profit,
      paymentStatus,
      input.paymentMethod,
      displayTime,
      displayDate
    );

    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price, cost_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare(`
      UPDATE products SET stock = stock - ?, sold_today = sold_today + ?,
        sold_this_week = sold_this_week + ?, updated_at = datetime('now') WHERE id = ?
    `);
    for (const line of pricedItems) {
      insertItem.run(
        id,
        line.product.id,
        line.product.name,
        line.quantity,
        line.product.sell_price,
        line.product.cost_price
      );
      updateStock.run(line.quantity, line.quantity, line.quantity, line.product.id);
    }

    if (customer) {
      db.prepare(`
        UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?,
          due_balance = due_balance + ?, last_visit = ?, last_order_date = ? WHERE id = ?
      `).run(
        amount,
        paymentStatus === 'Due' ? amount : 0,
        `Today, ${displayTime}`,
        displayDate,
        customer.id
      );
    }

    const day = now.toLocaleDateString('en-US', { weekday: 'short' });
    const dateLabel = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const existing = db.prepare('SELECT id FROM daily_sales WHERE sales_date = ?').get(isoDate) as
      | { id: number }
      | undefined;
    if (existing) {
      db.prepare('UPDATE daily_sales SET sales = sales + ?, profit = profit + ?, orders = orders + 1 WHERE id = ?')
        .run(amount, profit, existing.id);
    } else {
      db.prepare(`
        INSERT INTO daily_sales (day, date_label, sales, profit, orders, sales_date)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(day, dateLabel, amount, profit, isoDate);
    }
  })();

  res.status(201).json(getSale(id));
});

salesRouter.post('/:id/mark-paid', requirePermission('dues:write'), (req, res) => {
  const sale = getSale(req.params.id);
  if (!sale) {
    res.status(404).json({ error: 'Sale not found.' });
    return;
  }
  if (sale.paymentStatus !== 'Paid') {
    const db = getDb();
    db.transaction(() => {
      db.prepare("UPDATE sales SET payment_status = 'Paid', payment_method = 'Cash' WHERE id = ?").run(sale.id);
      if (sale.customerId !== 'walk-in') {
        db.prepare('UPDATE customers SET due_balance = MAX(due_balance - ?, 0) WHERE id = ?')
          .run(sale.amount, sale.customerId);
      }
    })();
  }
  res.json(getSale(sale.id));
});

salesRouter.delete('/:id', requirePermission('sales:delete'), (req, res) => {
  const result = getDb().prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Sale not found.' });
    return;
  }
  res.status(204).end();
});

const purchaseColumns =
  'id, po_number, supplier_id, supplier_name, items_summary, item_count, total_amount, paid_amount, status, purchase_date';

const purchaseInput = z.object({
  supplierName: z.string().trim().min(1),
  itemsSummary: z.string().trim().min(1),
  itemCount: z.number().int().positive(),
  totalAmount: z.number().positive(),
  paidAmount: z.number().nonnegative().default(0),
  status: z.enum(['Received', 'Pending']),
  date: z.string().trim().min(1),
});

purchasesRouter.get('/', requirePermission('purchases:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${purchaseColumns} FROM purchases ORDER BY created_at DESC`).all();
  res.json(rows.map(mapPurchase));
});

purchasesRouter.post('/', requirePermission('purchases:write'), (req, res) => {
  const input = parse(purchaseInput, req.body);
  const db = getDb();
  const supplier = db
    .prepare('SELECT id FROM suppliers WHERE company = ?')
    .get(input.supplierName) as { id: string } | undefined;
  const id = `po-${randomUUID()}`;
  const poNumber = `PO-${nextNumber('purchase', 8843)}`;
  const paidAmount = Math.min(input.paidAmount, input.totalAmount);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO purchases (
        id, po_number, supplier_id, supplier_name, items_summary, item_count,
        total_amount, paid_amount, status, purchase_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      poNumber,
      supplier?.id ?? null,
      input.supplierName,
      input.itemsSummary,
      input.itemCount,
      input.totalAmount,
      paidAmount,
      input.status,
      input.date
    );
    db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, description, quantity, unit_cost)
      VALUES (?, NULL, ?, ?, ?)
    `).run(id, input.itemsSummary, input.itemCount, input.totalAmount / input.itemCount);
  })();

  const row = db.prepare(`SELECT ${purchaseColumns} FROM purchases WHERE id = ?`).get(id);
  res.status(201).json(mapPurchase(row as Record<string, any>));
});

purchasesRouter.post('/:id/receive', requirePermission('purchases:write'), (req, res) => {
  const result = getDb().prepare("UPDATE purchases SET status = 'Received' WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Purchase order not found.' });
    return;
  }
  const row = getDb().prepare(`SELECT ${purchaseColumns} FROM purchases WHERE id = ?`).get(req.params.id);
  res.json(mapPurchase(row as Record<string, any>));
});

purchasesRouter.post('/:id/payment', requirePermission('purchases:write'), (req, res) => {
  const input = parse(z.object({ amount: z.number().positive() }), req.body);
  const row = getDb().prepare(`SELECT ${purchaseColumns} FROM purchases WHERE id = ?`).get(req.params.id) as
    | Record<string, any>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Purchase order not found.' });
    return;
  }
  const due = Math.max(row.total_amount - row.paid_amount, 0);
  const nextPaid = row.paid_amount + Math.min(input.amount, due);
  getDb().prepare('UPDATE purchases SET paid_amount = ? WHERE id = ?').run(nextPaid, row.id);
  const updated = getDb().prepare(`SELECT ${purchaseColumns} FROM purchases WHERE id = ?`).get(row.id);
  res.json(mapPurchase(updated as Record<string, any>));
});

purchasesRouter.delete('/:id', requirePermission('purchases:delete'), (req, res) => {
  const result = getDb().prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Purchase order not found.' });
    return;
  }
  res.status(204).end();
});
