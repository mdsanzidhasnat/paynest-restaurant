import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { id, now, pagination } from '../http.ts';
import { requirePermission, type AuthRequest } from '../middleware.ts';
import { withOrderNumber } from '../numbering.ts';
import { recomputeOrderStatus, recomputeTableStatus, transitionItem } from '../order-state.ts';
import { refreshOrderTotals } from '../order-totals.ts';
import { parse } from '../validate.ts';

export const ordersRouter = Router();

type Row = Record<string, any>;

const createOrderInput = z.object({
  tableId: z.string().trim().min(1),
  guestCount: z.number().int().nonnegative().default(0),
  notes: z.string().trim().default(''),
});

const addItemInput = z.object({
  menuItemId: z.string().trim().min(1),
  variantId: z.string().trim().min(1).optional(),
  quantity: z.number().int().positive(),
  notes: z.string().trim().default(''),
});

const transferInput = z.object({
  toTableId: z.string().trim().min(1),
});

const reasonInput = z.object({
  reason: z.string().trim().min(1),
});

function orderDetail(orderId: string): Row {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found.');
  return {
    ...order,
    items: db
      .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at, id')
      .all(orderId),
    payments: db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at').all(orderId),
    splits: db.prepare('SELECT * FROM bill_splits WHERE order_id = ? ORDER BY label').all(orderId),
  };
}

function assertOpenOrder(orderId: string): Row {
  const order = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status === 'closed' || order.payment_status !== 'unpaid') {
    throw new HttpError(409, 'This order is already closed.');
  }
  if (order.status === 'pending_confirmation') {
    throw new HttpError(409, 'Confirm this guest order before modifying it.');
  }
  return order;
}

function findItem(itemId: string, orderId: string): Row {
  const item = getDb()
    .prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?')
    .get(itemId, orderId) as Row | undefined;
  if (!item) throw new HttpError(404, 'Order item not found.');
  return item;
}

ordersRouter.get('/', requirePermission('orders:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  const status = req.query.status;
  const tableId = req.query.tableId;
  let sql = 'SELECT * FROM orders';
  const params: unknown[] = [];
  const filters: string[] = [];
  if (
    typeof status === 'string' &&
    ['pending_confirmation', 'new', 'preparing', 'ready', 'served', 'closed'].includes(status)
  ) {
    filters.push('status = ?');
    params.push(status);
  }
  if (typeof tableId === 'string') {
    filters.push('table_id = ?');
    params.push(tableId);
  }
  if (filters.length) sql += ` WHERE ${filters.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  res.json(getDb().prepare(sql).all(...params));
});

ordersRouter.get('/:id', requirePermission('orders:read'), (req, res) => {
  res.json(orderDetail(req.params.id));
});

ordersRouter.post('/', requirePermission('orders:write'), (req: AuthRequest, res) => {
  const input = parse(createOrderInput, req.body);
  const db = getDb();
  const table = db.prepare('SELECT id, status FROM tables WHERE id = ?').get(input.tableId) as
    | Row
    | undefined;
  if (!table) throw new HttpError(400, 'Unknown tableId.');
  if (table.status !== 'free') {
    throw new HttpError(409, 'That table already has an open order.');
  }

  const orderId = withOrderNumber(db, (orderNumber) => {
    const newId = id('ord');
    db.prepare(`
      INSERT INTO orders (id, order_number, table_id, source, status, opened_by, guest_count, notes)
      VALUES (?, ?, ?, 'waiter', 'new', ?, ?, ?)
    `).run(newId, orderNumber, input.tableId, req.auth!.userId, input.guestCount, input.notes);
    return newId;
  });
  recomputeTableStatus(db, input.tableId);
  res.status(201).json(orderDetail(orderId));
});

/** Waiter accepts a public order; only then can the kitchen see its items. */
ordersRouter.post('/:id/confirm', requirePermission('orders:write'), (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status !== 'pending_confirmation') {
    throw new HttpError(409, 'Only pending guest orders can be confirmed.');
  }
  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'new' WHERE id = ?").run(order.id);
    recomputeTableStatus(db, order.table_id);
  }).immediate();
  res.json(orderDetail(order.id));
});

ordersRouter.post('/:id/items', requirePermission('orders:write'), (req, res) => {
  const input = parse(addItemInput, req.body);
  const db = getDb();
  const order = assertOpenOrder(req.params.id);
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(input.menuItemId) as
    | Row
    | undefined;
  if (!item) throw new HttpError(400, 'Unknown menuItemId.');
  if (!item.available) throw new HttpError(409, 'That menu item is not available.');

  let variant: Row | undefined;
  let unitPrice = item.price as number;
  let variantName = '';
  if (input.variantId) {
    variant = db
      .prepare('SELECT * FROM item_variants WHERE id = ? AND menu_item_id = ?')
      .get(input.variantId, input.menuItemId) as Row | undefined;
    if (!variant) throw new HttpError(400, 'Unknown variantId for that menu item.');
    if (!variant.available) throw new HttpError(409, 'That variant is not available.');
    unitPrice = variant.price;
    variantName = variant.name;
  }

  const itemId = id('oi');
  db.prepare(`
    INSERT INTO order_items (id, order_id, menu_item_id, variant_id, name_snapshot,
      variant_name_snapshot, quantity, notes, status, unit_price, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
  `).run(
    itemId,
    order.id,
    item.id,
    variant?.id ?? null,
    item.name,
    variantName,
    input.quantity,
    input.notes,
    unitPrice,
    unitPrice * input.quantity
  );
  refreshOrderTotals(db, order.id);
  res.status(201).json(orderDetail(order.id));
});

ordersRouter.patch('/items/:itemId/notes', requirePermission('orders:write'), (req, res) => {
  const input = parse(z.object({ notes: z.string().trim().default('') }), req.body);
  const row = getDb()
    .prepare('SELECT order_id FROM order_items WHERE id = ?')
    .get(req.params.itemId) as Row | undefined;
  if (!row) throw new HttpError(404, 'Order item not found.');
  const order = assertOpenOrder(row.order_id);
  const result = getDb()
    .prepare('UPDATE order_items SET notes = ? WHERE id = ?')
    .run(input.notes, req.params.itemId);
  if (result.changes === 0) throw new HttpError(404, 'Order item not found.');
  res.json(orderDetail(order.id));
});

ordersRouter.delete('/items/:itemId', requirePermission('orders:write'), (req, res) => {
  const item = getDb().prepare('SELECT * FROM order_items WHERE id = ?').get(req.params.itemId) as
    | Row
    | undefined;
  if (!item) throw new HttpError(404, 'Order item not found.');
  const order = assertOpenOrder(item.order_id);
  if (item.status !== 'new') {
    throw new HttpError(409, 'Only new items can be removed. Cancel started items instead.');
  }
  getDb().prepare('DELETE FROM order_items WHERE id = ?').run(item.id);
  refreshOrderTotals(getDb(), order.id);
  res.json(orderDetail(order.id));
});

ordersRouter.post('/:id/transfer', requirePermission('orders:transfer'), (req: AuthRequest, res) => {
  const input = parse(transferInput, req.body);
  const db = getDb();
  const order = assertOpenOrder(req.params.id);
  if (input.toTableId === order.table_id) throw new HttpError(400, 'Order is already on that table.');
  const target = db.prepare('SELECT id, status FROM tables WHERE id = ?').get(input.toTableId) as
    | Row
    | undefined;
  if (!target) throw new HttpError(400, 'Unknown toTableId.');
  if (target.status !== 'free') throw new HttpError(409, 'The destination table is not free.');

  const transferId = id('trf');
  db.transaction(() => {
    db.prepare('UPDATE orders SET table_id = ? WHERE id = ?').run(input.toTableId, order.id);
    db.prepare(`
      INSERT INTO table_transfers (id, order_id, from_table_id, to_table_id, moved_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(transferId, order.id, order.table_id, input.toTableId, req.auth!.userId);
    recomputeTableStatus(db, order.table_id);
    recomputeTableStatus(db, input.toTableId);
  }).immediate();
  res.status(201).json({
    transfer: db.prepare('SELECT * FROM table_transfers WHERE id = ?').get(transferId),
    order: orderDetail(order.id),
  });
});

ordersRouter.post('/:id/cancel', requirePermission('orders:cancel'), (req: AuthRequest, res) => {
  const { reason } = parse(reasonInput, req.body);
  const db = getDb();
  const order = assertOpenOrder(req.params.id);
  const served = db
    .prepare("SELECT COUNT(*) AS count FROM order_items WHERE order_id = ? AND status = 'served'")
    .get(order.id) as { count: number };
  if (served.count > 0) {
    throw new HttpError(409, 'An order with served items cannot be cancelled.');
  }

  db.transaction(() => {
    const items = db
      .prepare("SELECT id, status FROM order_items WHERE order_id = ? AND status != 'cancelled'")
      .all(order.id) as Row[];
    for (const item of items) {
      db.prepare(`
        UPDATE order_items SET status = 'cancelled', cancel_reason = ? WHERE id = ?
      `).run(reason, item.id);
      db.prepare(`
        INSERT INTO order_item_events (order_item_id, from_status, to_status, actor_id)
        VALUES (?, ?, 'cancelled', ?)
      `).run(item.id, item.status, req.auth!.userId);
    }
    db.prepare(`
      UPDATE orders SET status = 'closed', payment_status = 'void', closed_at = ?, notes = ?
      WHERE id = ?
    `).run(now(), `Cancelled: ${reason}`, order.id);
    recomputeTableStatus(db, order.table_id);
  }).immediate();
  res.json(orderDetail(order.id));
});

ordersRouter.post(
  '/:id/items/:itemId/cancel',
  requirePermission('orders:cancel'),
  (req: AuthRequest, res) => {
    const { reason } = parse(reasonInput, req.body);
    const db = getDb();
    const item = findItem(req.params.itemId, req.params.id);
    assertOpenOrder(req.params.id);
    if (item.status === 'served') throw new HttpError(409, 'Served items cannot be cancelled.');
    db.transaction(() => {
      db.prepare("UPDATE order_items SET status = 'cancelled', cancel_reason = ? WHERE id = ?").run(
        reason,
        item.id
      );
      db.prepare(`
        INSERT INTO order_item_events (order_item_id, from_status, to_status, actor_id)
        VALUES (?, ?, 'cancelled', ?)
      `).run(item.id, item.status, req.auth!.userId);
      refreshOrderTotals(db, req.params.id);
      recomputeOrderStatus(db, req.params.id);
      const tableId = (db.prepare('SELECT table_id FROM orders WHERE id = ?').get(req.params.id) as Row)
        .table_id;
      recomputeTableStatus(db, tableId);
    }).immediate();
    res.json(orderDetail(req.params.id));
  }
);

ordersRouter.post(
  '/:id/items/:itemId/serve',
  requirePermission('orders:serve'),
  (req: AuthRequest, res) => {
    findItem(req.params.itemId, req.params.id);
    assertOpenOrder(req.params.id);
    const result = transitionItem(getDb(), req.params.itemId, 'served', req.auth!.userId);
    res.json({ ...result, order: orderDetail(req.params.id) });
  }
);
