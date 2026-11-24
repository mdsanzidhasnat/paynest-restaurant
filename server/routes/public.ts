import { Router, type Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { id } from '../http.ts';
import { withOrderNumber } from '../numbering.ts';
import { recomputeTableStatus } from '../order-state.ts';
import { refreshOrderTotals } from '../order-totals.ts';
import { verifyTableToken } from '../qr-token.ts';
import { parse } from '../validate.ts';

/**
 * Unauthenticated guest routes. Every request is bound to a signed table token
 * and these are the only staff-independent endpoints that expose menu data.
 * No cost, stock, recipe, staff or other-table information is ever returned.
 */
export const publicRouter = Router();

type Row = Record<string, any>;

const MAX_LINES = 20;
const MAX_LINE_QUANTITY = 20;
const MAX_TOTAL_QUANTITY = 50;

const tokenQuery = z.object({ token: z.string().min(1) });

const orderInput = z.object({
  token: z.string().min(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        variantId: z.string().min(1).optional(),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
        note: z.string().max(140).default(''),
      })
    )
    .min(1)
    .max(MAX_LINES),
});

function ipKey(req: Request): string {
  // express-rate-limit's helper collapses IPv6 clients to a safe subnet key.
  return ipKeyGenerator(String(req.ip ?? req.socket.remoteAddress ?? 'unknown'));
}

function tokenKey(req: Request): string {
  const token = req.body?.token ?? req.query?.token;
  return typeof token === 'string' && token ? token : ipKey(req);
}

const tooManyRequests = { error: 'Too many requests. Please wait a minute.' };

/** Shared per-IP ceiling across all guest reads. */
export const publicReadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: tooManyRequests,
});

/** Orders are capped both per IP and per table token. */
export const publicOrderIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: tooManyRequests,
});

export const publicOrderTableLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tokenKey,
  message: { error: 'Too many orders from this table. Please wait a minute.' },
});

function invalidToken(): HttpError {
  return new HttpError(401, 'Invalid or expired table token.');
}

/** Signature, expiry, table existence and the current secret version must all match. */
function tableForToken(token: string): Row {
  const payload = verifyTableToken(token);
  if (!payload) throw invalidToken();
  const table = getDb()
    .prepare(`
      SELECT t.*, f.name AS floor_name FROM tables t JOIN floors f ON f.id = t.floor_id
      WHERE t.id = ?
    `)
    .get(payload.tableId) as Row | undefined;
  if (!table || table.qr_secret_version !== payload.version) throw invalidToken();
  return table;
}

function tableLabel(table: Row): string {
  return `Table ${table.number}`;
}

publicRouter.get('/menu', publicReadLimiter, (req, res) => {
  const { token } = parse(tokenQuery, req.query);
  const table = tableForToken(token);
  const db = getDb();
  const settings = db
    .prepare('SELECT restaurant_name FROM settings WHERE id = 1')
    .get() as Row;
  const categories = db
    .prepare(`
      SELECT c.id, c.name, c.description
      FROM menu_categories c
      WHERE c.active = 1 AND EXISTS (
        SELECT 1 FROM menu_items mi WHERE mi.category_id = c.id AND mi.available = 1
      )
      ORDER BY c.sort_order, c.name
    `)
    .all() as Row[];
  const itemStatement = db.prepare(`
    SELECT id, name, description, image, price FROM menu_items
    WHERE category_id = ? AND available = 1 ORDER BY sort_order, name
  `);
  const variantStatement = db.prepare(`
    SELECT id, name, price FROM item_variants
    WHERE menu_item_id = ? AND available = 1 ORDER BY sort_order, name
  `);

  res.json({
    restaurantName: settings.restaurant_name,
    table: { label: tableLabel(table) },
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      items: (itemStatement.all(category.id) as Row[]).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image ?? null,
        price: item.price,
        variants: variantStatement.all(item.id) as Row[],
      })),
    })),
  });
});

publicRouter.post('/orders', publicOrderIpLimiter, publicOrderTableLimiter, (req, res) => {
  const input = parse(orderInput, req.body);
  const table = tableForToken(input.token);
  const totalQuantity = input.items.reduce((sum, line) => sum + line.quantity, 0);
  if (totalQuantity > MAX_TOTAL_QUANTITY) {
    throw new HttpError(400, `An order can contain at most ${MAX_TOTAL_QUANTITY} items.`);
  }

  const db = getDb();
  // Prices and names are resolved here; unknown client price fields are
  // stripped by Zod and never read. Unavailable items never reach the kitchen.
  const lines = input.items.map((line) => {
    const item = db
      .prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?')
      .get(line.menuItemId) as Row | undefined;
    if (!item) throw new HttpError(400, `Unknown menu item: ${line.menuItemId}`);
    if (!item.available) throw new HttpError(409, `${item.name} is not available.`);

    let variant: Row | undefined;
    let unitPrice = item.price as number;
    let variantName = '';
    if (line.variantId) {
      variant = db
        .prepare(`
          SELECT id, name, price, available FROM item_variants
          WHERE id = ? AND menu_item_id = ?
        `)
        .get(line.variantId, item.id) as Row | undefined;
      if (!variant) throw new HttpError(400, `Unknown variant for ${item.name}.`);
      if (!variant.available) throw new HttpError(409, `${variant.name} is not available.`);
      unitPrice = variant.price;
      variantName = variant.name;
    }
    return { item, variant, unitPrice, variantName, quantity: line.quantity, note: line.note };
  });

  const settings = db
    .prepare('SELECT auto_confirm_public_orders FROM settings WHERE id = 1')
    .get() as Row;
  const status = settings.auto_confirm_public_orders === 1 ? 'new' : 'pending_confirmation';

  const orderId = withOrderNumber(db, (orderNumber) => {
    const newId = id('ord');
    db.prepare(`
      INSERT INTO orders (id, order_number, table_id, source, status, opened_by, guest_count, notes)
      VALUES (?, ?, ?, 'qr', ?, NULL, 0, '')
    `).run(newId, orderNumber, table.id, status);

    const insertLine = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, variant_id, name_snapshot,
        variant_name_snapshot, quantity, notes, status, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
    `);
    for (const line of lines) {
      insertLine.run(
        id('oi'),
        newId,
        line.item.id,
        line.variant?.id ?? null,
        line.item.name,
        line.variantName,
        line.quantity,
        line.note,
        line.unitPrice,
        line.unitPrice * line.quantity
      );
    }
    return newId;
  });

  refreshOrderTotals(db, orderId);
  recomputeTableStatus(db, table.id);
  res.status(201).json({ orderId, status, tableLabel: tableLabel(table) });
});

publicRouter.get('/orders/:id', publicReadLimiter, (req, res) => {
  const { token } = parse(tokenQuery, req.query);
  const table = tableForToken(token);
  const order = getDb()
    .prepare(`
      SELECT id, status, created_at FROM orders
      WHERE id = ? AND table_id = ? AND source = 'qr'
    `)
    .get(req.params.id, table.id) as Row | undefined;
  if (!order) throw new HttpError(404, 'Order not found for this table.');

  res.json({
    orderId: order.id,
    status: order.status,
    tableLabel: tableLabel(table),
    items: getDb()
      .prepare(`
        SELECT id, name_snapshot AS name, status FROM order_items
        WHERE order_id = ? ORDER BY created_at, id
      `)
      .all(order.id),
  });
});
