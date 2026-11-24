import type Database from 'better-sqlite3';
import { calculateOrderTotals, type OrderTotals } from './billing.ts';
import { now } from './http.ts';
import { recomputeTableStatus } from './order-state.ts';

interface BillableRow {
  quantity: number;
  unit_price: number;
}

interface SettingsRow {
  vat_percent: number;
  service_charge_percent: number;
}

/**
 * Recomputes every stored money column from menu price snapshots and settings.
 * The existing discount (already resolved to minor units) is preserved but
 * clamped to the current subtotal by the shared billing helper.
 */
export function refreshOrderTotals(db: Database.Database, orderId: string): OrderTotals {
  const order = db.prepare('SELECT discount FROM orders WHERE id = ?').get(orderId) as
    | { discount: number }
    | undefined;
  if (!order) throw new Error(`Order ${orderId} does not exist.`);

  const lines = db
    .prepare(`SELECT quantity, unit_price FROM order_items WHERE order_id = ? AND status != 'cancelled'`)
    .all(orderId) as BillableRow[];
  const settings = db
    .prepare('SELECT vat_percent, service_charge_percent FROM settings WHERE id = 1')
    .get() as SettingsRow;

  const totals = calculateOrderTotals(
    lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unit_price })),
    order.discount,
    {
      vatPercent: settings.vat_percent,
      serviceChargePercent: settings.service_charge_percent,
    }
  );

  db.prepare(`
    UPDATE orders SET subtotal = ?, discount = ?, vat_amount = ?, service_charge = ?, total = ?
    WHERE id = ?
  `).run(totals.subtotal, totals.discount, totals.vatAmount, totals.serviceCharge, totals.total, orderId);
  return totals;
}

/** Marks an order closed when recorded payments cover the server total. */
export function closeIfPaid(db: Database.Database, orderId: string): boolean {
  const row = db
    .prepare(`
      SELECT o.total, o.table_id, o.status,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS paid
      FROM orders o WHERE o.id = ?
    `)
    .get(orderId) as
    | { total: number; table_id: string; status: string; paid: number }
    | undefined;
  if (!row || row.status === 'closed' || row.paid < row.total) return false;

  const stamp = now();
  db.prepare(`
    UPDATE orders SET payment_status = 'paid', status = 'closed',
      closed_at = COALESCE(closed_at, ?), paid_at = ? WHERE id = ?
  `).run(stamp, stamp, orderId);
  recomputeTableStatus(db, row.table_id);
  return true;
}
