import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { pagination } from '../http.ts';
import { requirePermission, type AuthRequest } from '../middleware.ts';
import { transitionItem, type ItemStatus } from '../order-state.ts';
import { roleAllows } from '../permissions.ts';
import { parse } from '../validate.ts';

export const kitchenRouter = Router();

type Row = Record<string, any>;

const statusInput = z.object({
  status: z.enum(['new', 'preparing', 'ready']),
});

const CHAIN: ItemStatus[] = ['new', 'preparing', 'ready', 'served', 'cancelled'];

kitchenRouter.get('/tickets', requirePermission('kitchen:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  const rows = getDb()
    .prepare(`
      SELECT oi.*, o.order_number, o.table_id, o.status AS order_status,
        t.number AS table_number, f.name AS floor_name,
        ROUND((julianday('now') - julianday(oi.created_at)) * 1440) AS age_minutes
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN tables t ON t.id = o.table_id
      JOIN floors f ON f.id = t.floor_id
      WHERE oi.status IN ('new', 'preparing', 'ready')
        AND o.status NOT IN ('closed', 'pending_confirmation')
        AND o.payment_status = 'unpaid'
      ORDER BY oi.created_at ASC
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset);
  res.json(rows);
});

kitchenRouter.get('/orders/:id', requirePermission('kitchen:read'), (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found.');
  res.json({
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at').all(order.id),
    events: db
      .prepare(`
        SELECT e.* FROM order_item_events e
        JOIN order_items oi ON oi.id = e.order_item_id
        WHERE oi.order_id = ? ORDER BY e.created_at
      `)
      .all(order.id),
  });
});

kitchenRouter.patch('/items/:id/status', requirePermission('kitchen:transition'), (req: AuthRequest, res) => {
  const input = parse(statusInput, req.body);
  const db = getDb();
  const item = db.prepare('SELECT id, status FROM order_items WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!item) throw new HttpError(404, 'Order item not found.');

  const from = item.status as ItemStatus;
  const backward = CHAIN.indexOf(input.status) < CHAIN.indexOf(from);
  if (backward && (!req.auth || !roleAllows(req.auth.role, 'orders:override'))) {
    throw new HttpError(403, 'Only a manager can move an item backwards.');
  }
  const result = transitionItem(db, req.params.id, input.status, req.auth!.userId, {
    allowBackward: backward,
  });
  res.json(result);
});
