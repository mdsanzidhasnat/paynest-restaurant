import type Database from 'better-sqlite3';
import { HttpError } from './errors.ts';
import { now } from './http.ts';

export type ItemStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

const FORWARD: Record<ItemStatus, ItemStatus[]> = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
};

const BACKWARD: Record<ItemStatus, ItemStatus[]> = {
  new: [],
  preparing: ['new'],
  ready: ['preparing'],
  served: ['ready'],
  cancelled: [],
};

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  status: ItemStatus;
}

export interface TransitionResult {
  item: Record<string, unknown>;
  lowStock: boolean;
  orderStatus: string;
}

/** Recomputes the order status from its lines; never trusts a client status. */
export function recomputeOrderStatus(db: Database.Database, orderId: string): string {
  const order = db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(orderId) as
    | { status: string; payment_status: string }
    | undefined;
  if (!order) return 'closed';
  if (order.payment_status === 'paid' || order.status === 'closed') return 'closed';
  // Never auto-activate a guest order that is still awaiting staff confirmation.
  if (order.status === 'pending_confirmation') return 'pending_confirmation';

  const rows = db
    .prepare("SELECT status FROM order_items WHERE order_id = ? AND status != 'cancelled'")
    .all(orderId) as Array<{ status: ItemStatus }>;
  let status: ItemStatus = 'served';
  if (rows.some((row) => row.status === 'new')) status = 'new';
  else if (rows.some((row) => row.status === 'preparing')) status = 'preparing';
  else if (rows.some((row) => row.status === 'ready')) status = 'ready';

  if (order.status !== status) {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  }
  return status;
}

/** Table status is derived from open orders and bills; no endpoint writes it directly. */
export function recomputeTableStatus(db: Database.Database, tableId: string): void {
  const row = db
    .prepare(`
      SELECT
        MAX(CASE WHEN payment_status = 'unpaid' AND bill_number IS NOT NULL THEN 1 ELSE 0 END) AS billing,
        MAX(CASE WHEN payment_status = 'unpaid' AND bill_number IS NULL
          AND status != 'pending_confirmation' THEN 1 ELSE 0 END) AS occupied
      FROM orders WHERE table_id = ?
    `)
    .get(tableId) as { billing: number; occupied: number } | undefined;
  const status = row?.billing ? 'bill_pending' : row?.occupied ? 'occupied' : 'free';
  db.prepare("UPDATE tables SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), tableId);
}

function deductRecipeStock(db: Database.Database, item: OrderItemRow, actorId: string | null): boolean {
  // A manager may move a served item back to ready. Serving it again must not
  // deduct the recipe a second time (stock_movements is unique per item/reason).
  const alreadyDeducted = db
    .prepare("SELECT 1 FROM stock_movements WHERE order_item_id = ? AND reason = 'served'")
    .get(item.id);
  if (alreadyDeducted) return false;

  const recipe = db
    .prepare(`
      SELECT r.quantity, r.ingredient_id, i.name, i.stock, i.low_stock_threshold
      FROM recipe_items r JOIN ingredients i ON i.id = r.ingredient_id
      WHERE r.menu_item_id = ?
    `)
    .all(item.menu_item_id) as Array<{
    ingredient_id: string;
    name: string;
    quantity: number;
    stock: number;
    low_stock_threshold: number;
  }>;

  for (const line of recipe) {
    const needed = line.quantity * item.quantity;
    if (line.stock + 1e-9 < needed) {
      throw new HttpError(
        409,
        `Insufficient stock for ${line.name}: need ${needed}, have ${line.stock}.`,
        { lowStock: true, ingredientId: line.ingredient_id }
      );
    }
  }

  let lowStock = false;
  for (const line of recipe) {
    const needed = line.quantity * item.quantity;
    db.prepare(
      'UPDATE ingredients SET stock = stock - ?, updated_at = ? WHERE id = ?'
    ).run(needed, now(), line.ingredient_id);
    db.prepare(`
      INSERT INTO stock_movements (ingredient_id, order_item_id, quantity, reason, note, created_by)
      VALUES (?, ?, ?, 'served', ?, ?)
    `).run(line.ingredient_id, item.id, -needed, `Served order item ${item.id}`, actorId);
    lowStock ||= line.stock - needed <= line.low_stock_threshold;
  }
  return lowStock;
}

/**
 * Applies a validated item status change in one transaction: writes the event,
 * deducts recipe stock when serving, recomputes order and table status.
 */
export function transitionItem(
  db: Database.Database,
  itemId: string,
  toStatus: ItemStatus,
  actorId: string | null,
  options: { allowBackward?: boolean; reason?: string } = {}
): TransitionResult {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as
      | (OrderItemRow & Record<string, unknown>)
      | undefined;
    if (!item) throw new HttpError(404, 'Order item not found.');

    // A guest order is invisible to the kitchen until a waiter accepts it;
    // block every item transition (including serves) before confirmation.
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(item.order_id) as
      | { status: string }
      | undefined;
    if (order?.status === 'pending_confirmation') {
      throw new HttpError(409, 'Confirm this guest order before changing item status.');
    }

    const from = item.status as ItemStatus;
    const isForward = FORWARD[from].includes(toStatus);
    const isBackward = BACKWARD[from].includes(toStatus);
    if (!isForward && !(isBackward && options.allowBackward)) {
      throw new HttpError(409, `Cannot change item status from ${from} to ${toStatus}.`);
    }
    if (toStatus === 'cancelled' && !options.reason) {
      throw new HttpError(400, 'A cancellation reason is required.');
    }

    let lowStock = false;
    if (toStatus === 'served' && from !== 'served') {
      lowStock = deductRecipeStock(db, item, actorId);
    }

    db.prepare(`
      UPDATE order_items SET status = ?, served_at = CASE WHEN ? = 'served' THEN ? ELSE served_at END,
        cancel_reason = CASE WHEN ? = 'cancelled' THEN ? ELSE cancel_reason END WHERE id = ?
    `).run(toStatus, toStatus, now(), toStatus, options.reason ?? null, itemId);
    db.prepare(`
      INSERT INTO order_item_events (order_item_id, from_status, to_status, actor_id)
      VALUES (?, ?, ?, ?)
    `).run(itemId, from, toStatus, actorId);

    const orderStatus = recomputeOrderStatus(db, item.order_id);
    const tableId = (db.prepare('SELECT table_id FROM orders WHERE id = ?').get(item.order_id) as { table_id: string }).table_id;
    recomputeTableStatus(db, tableId);

    const updated = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as Record<string, unknown>;
    return { item: updated, lowStock, orderStatus };
  }).immediate();
}
