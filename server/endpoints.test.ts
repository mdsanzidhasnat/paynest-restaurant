import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { closeDb, initDb } from './db.ts';
import { verifyTableToken } from './qr-token.ts';

type Agent = ReturnType<typeof request.agent>;

let app: ReturnType<typeof createApp>;
let tempDir: string;
let agents: Record<string, Agent>;
const demoPassword = randomBytes(18).toString('base64url');
const ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'];
const marker = randomUUID().slice(0, 8);

const json = { 'Content-Type': 'application/json' };

async function call(role: string, method: string, url: string, body?: unknown) {
  const agent = agents[role] as any;
  const req = agent[method](url).set(json);
  if (body !== undefined) req.send(body);
  return req;
}

async function newTable(): Promise<string> {
  const response = await call('manager', 'post', '/api/tables', {
    floorId: 'f1',
    number: `T-${randomUUID().slice(0, 8)}`,
    seats: 4,
  });
  expect(response.status).toBe(201);
  return response.body.id;
}

async function newOrder(role = 'waiter'): Promise<any> {
  const tableId = await newTable();
  const response = await call(role, 'post', '/api/orders', { tableId, guestCount: 2 });
  expect(response.status).toBe(201);
  return response.body;
}

async function addItem(orderId: string, menuItemId = 'm1', quantity = 1): Promise<any> {
  const response = await call('waiter', 'post', `/api/orders/${orderId}/items`, {
    menuItemId,
    quantity,
  });
  expect(response.status).toBe(201);
  return response.body;
}

async function newIngredient(stock: number, threshold: number): Promise<any> {
  const response = await call('manager', 'post', '/api/inventory/ingredients', {
    name: `Test ingredient ${randomUUID().slice(0, 8)}`,
    unit: 'kg',
    stock,
    lowStockThreshold: threshold,
    unitCost: 1000,
  });
  expect(response.status).toBe(201);
  return response.body;
}

async function newRecipeItem(ingredientId: string, price = 20_000): Promise<any> {
  const item = await call('manager', 'post', '/api/menu', {
    categoryId: 'c1',
    name: `Test dish ${randomUUID().slice(0, 8)}`,
    price,
  });
  expect(item.status).toBe(201);
  const recipe = await call('manager', 'put', `/api/inventory/recipes/${item.body.id}`, {
    lines: [{ ingredientId, quantity: 1 }],
  });
  expect(recipe.status).toBe(200);
  return item.body;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SEED_DEMO_DATA = 'true';
  process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-signing';
  process.env.MAX_CASHIER_DISCOUNT_PERCENT = '10';
  for (const role of ROLES) {
    process.env[`${role.toUpperCase()}_PASSWORD`] = demoPassword;
    process.env[`${role.toUpperCase()}_EMAIL`] = `${role}@example.test`;
  }
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paynest-endpoints-'));
  initDb(path.join(tempDir, 'test.sqlite'), { reset: true });
  app = createApp();
  agents = {};
  for (const role of ROLES) {
    agents[role] = request.agent(app);
    const login = await agents[role]
      .post('/api/auth/login')
      .set(json)
      .send({ email: `${role}@example.test`, password: demoPassword });
    expect(login.status).toBe(200);
  }
});

afterAll(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('role allow and deny matrix', () => {
  it.each([
    ['get', '/api/tables', undefined, 'waiter', 200],
    ['post', '/api/tables', { floorId: 'f1', number: `D-${marker}` }, 'waiter', 403],
    ['post', '/api/tables', { floorId: 'f1', number: `D-${marker}` }, 'manager', 201],
    ['post', '/api/menu', { categoryId: 'c1', name: `Dish ${marker}`, price: 1000 }, 'cashier', 403],
    ['patch', '/api/menu/m1/availability', { available: false }, 'kitchen', 200],
    ['get', '/api/kitchen/tickets', undefined, 'waiter', 403],
    ['get', '/api/kitchen/tickets', undefined, 'kitchen', 200],
    ['get', '/api/reports/dashboard', undefined, 'cashier', 403],
    ['get', '/api/reports/dashboard', undefined, 'manager', 200],
    ['get', '/api/users', undefined, 'manager', 403],
    ['get', '/api/users', undefined, 'admin', 200],
    ['put', '/api/settings', { restaurantName: 'Nope' }, 'manager', 403],
    ['get', '/api/settings/invoice', undefined, 'kitchen', 200],
    ['post', '/api/bills/orders/o1/discount', { type: 'percent', value: 5 }, 'waiter', 403],
  ])('%s %s body=%s role=%s status=%s', async (method, url, body, role, status) => {
    const response = await call(role as string, method as string, url as string, body);
    expect(response.status).toBe(status);
  });

  it('restores menu availability after the kitchen toggle', async () => {
    const response = await call('manager', 'patch', '/api/menu/m1/availability', { available: true });
    expect(response.status).toBe(200);
  });
});

describe('tables and QR tokens', () => {
  it('exposes a table map grouped by floor', async () => {
    const response = await call('waiter', 'get', '/api/tables/map');
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].tables.length).toBeGreaterThan(0);
  });

  it('issues and rotates a signed table token', async () => {
    const tableId = await newTable();
    const issued = await call('waiter', 'get', `/api/tables/${tableId}/qr`);
    expect(issued.status).toBe(200);
    const payload = verifyTableToken(issued.body.token);
    expect(payload).toMatchObject({ tableId, version: 1 });
    expect(payload?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifyTableToken(`${issued.body.token}tampered`)).toBeNull();

    const denied = await call('waiter', 'post', `/api/tables/${tableId}/qr/rotate`, {});
    expect(denied.status).toBe(403);
    const rotated = await call('manager', 'post', `/api/tables/${tableId}/qr/rotate`, {});
    expect(rotated.status).toBe(200);
    expect(rotated.body.version).toBe(2);
    expect(verifyTableToken(issued.body.token)?.version).toBe(1);
    expect(verifyTableToken(rotated.body.token)?.version).toBe(2);
  });

  it('rejects mutating requests without a JSON content type', async () => {
    const response = await agents.waiter.post('/api/tables').set('Content-Type', 'text/plain').send('{}');
    expect(response.status).toBe(415);
  });

  it('validates pagination parameters', async () => {
    expect((await call('waiter', 'get', '/api/tables?limit=99999')).status).toBe(400);
    expect((await call('waiter', 'get', '/api/tables?offset=-1')).status).toBe(400);
  });
});

describe('orders and the kitchen state machine', () => {
  it('allocates unique order numbers and snapshots menu prices', async () => {
    const first = await newOrder();
    const second = await newOrder();
    expect(first.order_number).toMatch(/^ORD-\d{4}$/);
    expect(second.order_number).toMatch(/^ORD-\d{4}$/);
    expect(second.order_number).not.toBe(first.order_number);
    expect(first.status).toBe('new');
    expect(first.subtotal).toBe(0);

    const withItem = await addItem(first.id, 'm1', 2);
    expect(withItem.items).toHaveLength(1);
    expect(withItem.items[0].unit_price).toBeGreaterThan(0);
    expect(withItem.subtotal).toBe(withItem.items[0].line_total);
    expect(withItem.total).toBeGreaterThanOrEqual(withItem.subtotal);
  });

  it('rejects skipped and backward item transitions with 409/403', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1');
    const fresh = (await call('waiter', 'get', `/api/orders/${order.id}`)).body;
    const id = fresh.items[0].id;

    const skip = await call('kitchen', 'patch', `/api/kitchen/items/${id}/status`, { status: 'ready' });
    expect(skip.status).toBe(409);

    const preparing = await call('kitchen', 'patch', `/api/kitchen/items/${id}/status`, { status: 'preparing' });
    expect(preparing.status).toBe(200);
    const ready = await call('kitchen', 'patch', `/api/kitchen/items/${id}/status`, { status: 'ready' });
    expect(ready.status).toBe(200);

    const backward = await call('kitchen', 'patch', `/api/kitchen/items/${id}/status`, { status: 'preparing' });
    expect(backward.status).toBe(403);
    const override = await call('manager', 'patch', `/api/kitchen/items/${id}/status`, { status: 'preparing' });
    expect(override.status).toBe(200);
  });

  it('serves items, deducts stock and records a movement', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1');
    const detail = (await call('waiter', 'get', `/api/orders/${order.id}`)).body;
    const itemId = detail.items[0].id;
    await call('kitchen', 'patch', `/api/kitchen/items/${itemId}/status`, { status: 'preparing' });
    await call('kitchen', 'patch', `/api/kitchen/items/${itemId}/status`, { status: 'ready' });

    const before = (await call('manager', 'get', '/api/inventory/ingredients/i1')).body.stock;
    const served = await call('waiter', 'post', `/api/orders/${order.id}/items/${itemId}/serve`, {});
    expect(served.status, JSON.stringify(served.body)).toBe(200);
    const after = (await call('manager', 'get', '/api/inventory/ingredients/i1')).body.stock;
    expect(after).toBeLessThan(before);
    const movements = (await call('manager', 'get', '/api/inventory/movements')).body;
    expect(movements.some((m: any) => m.order_item_id === itemId && m.reason === 'served')).toBe(true);

    // A manager can move it back, but re-serving must not double-deduct.
    const back = await call('manager', 'patch', `/api/kitchen/items/${itemId}/status`, { status: 'ready' });
    expect(back.status).toBe(200);
    const again = await call('waiter', 'post', `/api/orders/${order.id}/items/${itemId}/serve`, {});
    expect(again.status).toBe(200);
    const afterAgain = (await call('manager', 'get', '/api/inventory/ingredients/i1')).body.stock;
    expect(afterAgain).toBe(after);
  });

  it('requires a reason for cancellation and blocks waiter cancellation', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1');
    const noReason = await call('manager', 'post', `/api/orders/${order.id}/cancel`, {});
    expect(noReason.status).toBe(400);
    const denied = await call('waiter', 'post', `/api/orders/${order.id}/cancel`, { reason: 'mistake' });
    expect(denied.status).toBe(403);
    const cancelled = await call('manager', 'post', `/api/orders/${order.id}/cancel`, { reason: 'mistake' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.payment_status).toBe('void');
  });

  it('transfers an order to a free table and records the move', async () => {
    const order = await newOrder();
    const target = await newTable();
    const response = await call('waiter', 'post', `/api/orders/${order.id}/transfer`, { toTableId: target });
    expect(response.status).toBe(201);
    expect(response.body.order.table_id).toBe(target);
    expect(response.body.transfer.from_table_id).toBe(order.table_id);
  });
});

describe('stock rollback on insufficient ingredients', () => {
  it('returns 409 with lowStock and leaves the item ready', async () => {
    const ingredient = await newIngredient(0, 0);
    const item = await newRecipeItem(ingredient.id);
    const order = await newOrder();
    await addItem(order.id, item.id);
    const fresh = (await call('waiter', 'get', `/api/orders/${order.id}`)).body;
    const itemId = fresh.items[0].id;
    await call('kitchen', 'patch', `/api/kitchen/items/${itemId}/status`, { status: 'preparing' });
    await call('kitchen', 'patch', `/api/kitchen/items/${itemId}/status`, { status: 'ready' });

    const served = await call('waiter', 'post', `/api/orders/${order.id}/items/${itemId}/serve`, {});
    expect(served.status).toBe(409);
    expect(served.body.lowStock).toBe(true);
    expect(served.body.ingredientId).toBe(ingredient.id);
    const stillReady = (await call('waiter', 'get', `/api/orders/${order.id}`)).body.items[0].status;
    expect(stillReady).toBe('ready');
    expect((await call('manager', 'get', `/api/inventory/ingredients/${ingredient.id}`)).body.stock).toBe(0);

    const adjusted = await call('manager', 'post', `/api/inventory/ingredients/${ingredient.id}/adjust`, {
      quantity: 5,
      note: 'restock',
    });
    expect(adjusted.status).toBe(201);
    const retry = await call('waiter', 'post', `/api/orders/${order.id}/items/${itemId}/serve`, {});
    expect(retry.status).toBe(200);
    expect((await call('manager', 'get', `/api/inventory/ingredients/${ingredient.id}`)).body.stock).toBe(4);
  });
});

describe('billing', () => {
  it('computes totals on the server and clamps discounts to subtotal', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1', 2);
    const bill = (await call('waiter', 'get', `/api/bills/orders/${order.id}`)).body;
    expect(bill.totals.subtotal).toBeGreaterThan(0);
    expect(bill.totals.total).toBe(
      bill.totals.subtotal - bill.totals.discount + bill.totals.vatAmount + bill.totals.serviceCharge
    );

    const clamped = await call('manager', 'post', `/api/bills/orders/${order.id}/discount`, {
      type: 'percent',
      value: 250,
    });
    expect(clamped.status).toBe(200);
    expect(clamped.body.totals.discount).toBe(bill.totals.subtotal);
    expect(clamped.body.totals.total).toBe(0);
  });

  it('caps cashier discounts via MAX_CASHIER_DISCOUNT_PERCENT', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1', 2);
    const subtotal = (await call('cashier', 'get', `/api/bills/orders/${order.id}`)).body.totals.subtotal;
    const expected = Math.floor((subtotal * 10) / 100);

    const percent = await call('cashier', 'post', `/api/bills/orders/${order.id}/discount`, {
      type: 'percent',
      value: 50,
    });
    expect(percent.status).toBe(200);
    expect(percent.body.totals.discount).toBe(expected);

    const fixed = await call('cashier', 'post', `/api/bills/orders/${order.id}/discount`, {
      type: 'fixed',
      value: 99_999_999,
    });
    expect(fixed.status).toBe(200);
    expect(fixed.body.totals.discount).toBe(expected);
  });

  it('splits by equal parts and by items with exact totals', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1', 2);
    await addItem(order.id, 'm2', 1);
    const total = (await call('manager', 'get', `/api/bills/orders/${order.id}`)).body.totals.total;

    const equal = await call('cashier', 'post', `/api/bills/orders/${order.id}/splits`, {
      mode: 'equal',
      parts: 3,
    });
    expect(equal.status).toBe(201);
    expect(equal.body.splits).toHaveLength(3);
    expect(equal.body.splits.reduce((sum: number, s: any) => sum + s.amount, 0)).toBe(total);
    expect(equal.body.splits[0].amount).toBe(Math.floor(total / 3));

    const items = await call('cashier', 'post', `/api/bills/orders/${order.id}/splits`, { mode: 'items' });
    expect(items.status).toBe(201);
    expect(items.body.splits).toHaveLength(2);
    expect(items.body.splits.reduce((sum: number, s: any) => sum + s.amount, 0)).toBe(total);
  });

  it('requests a bill, records split payments, closes and frees the table', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1', 3);
    const requested = await call('waiter', 'post', `/api/bills/orders/${order.id}/request`, {});
    expect(requested.status).toBe(201);
    expect(requested.body.order.bill_number).toMatch(/^INV-\d{4}$/);
    const tableStatus = (await call('waiter', 'get', `/api/tables/${order.table_id}`)).body.status;
    expect(tableStatus).toBe('bill_pending');

    const split = await call('cashier', 'post', `/api/bills/orders/${order.id}/splits`, {
      mode: 'equal',
      parts: 2,
    });
    const [first, second] = split.body.splits;
    const partial = await call('cashier', 'post', `/api/bills/orders/${order.id}/payments`, {
      method: 'Cash',
      amount: first.amount,
      splitId: first.id,
    });
    expect(partial.status).toBe(201);
    expect(partial.body.order.payment_status).toBe('unpaid');
    expect((await call('waiter', 'get', `/api/tables/${order.table_id}`)).body.status).toBe('bill_pending');

    const final = await call('cashier', 'post', `/api/bills/orders/${order.id}/payments`, {
      method: 'bKash',
      amount: second.amount,
      splitId: second.id,
      reference: 'BK-123',
    });
    expect(final.status).toBe(201);
    expect(final.body.order.payment_status).toBe('paid');
    expect(final.body.order.status).toBe('closed');
    expect(final.body.due).toBe(0);
    expect((await call('waiter', 'get', `/api/tables/${order.table_id}`)).body.status).toBe('free');

    const invoice = await call('cashier', 'get', `/api/bills/orders/${order.id}/invoice`);
    expect(invoice.status).toBe(200);
    expect(invoice.body.invoiceNumber).toBe(requested.body.order.bill_number);
    expect(invoice.body.settings.restaurant_name).toBeTruthy();
  });

  it('refuses to close an uncovered bill', async () => {
    const order = await newOrder();
    await addItem(order.id, 'm1');
    const response = await call('cashier', 'post', `/api/bills/orders/${order.id}/close`, {});
    expect(response.status).toBe(409);
  });
});

describe('inventory and reports', () => {
  it('lists low stock and stock movements', async () => {
    const ingredient = await newIngredient(1, 5);
    const response = await call('kitchen', 'get', '/api/inventory/low-stock');
    expect(response.status).toBe(200);
    expect(response.body.some((row: any) => row.id === ingredient.id)).toBe(true);
    const count = await call('manager', 'get', '/api/reports/low-stock');
    expect(count.status).toBe(200);
    expect(count.body.count).toBeGreaterThan(0);
  });

  it('exposes every report to managers only', async () => {
    for (const path of ['/api/reports/dashboard', '/api/reports/daily-sales', '/api/reports/top-items', '/api/reports/table-turnover', '/api/reports/low-stock', '/api/reports']) {
      const manager = await call('manager', 'get', path);
      const cashier = await call('cashier', 'get', path);
      expect(manager.status, path).toBe(200);
      expect(cashier.status, path).toBe(403);
    }
  });
});

describe('users and settings protections', () => {
  it('blocks self-role changes, last-admin demotion and invalid roles', async () => {
    const self = await call('admin', 'put', '/api/users/u1', {
      name: 'Sanzid Hasnat',
      email: 'admin@example.test',
      phone: '',
      role: 'manager',
    });
    expect(self.status).toBe(403);

    const lastAdmin = await call('admin', 'post', '/api/users/u1/toggle', {});
    expect(lastAdmin.status).toBe(409);

    const invalid = await call('admin', 'post', '/api/users', {
      name: 'Bad Role',
      email: `bad-${marker}@example.test`,
      phone: '',
      role: 'owner',
      password: demoPassword,
    });
    expect(invalid.status).toBe(400);
  });

  it('rejects tokens for deactivated users', async () => {
    const email = `deactivated-${marker}@example.test`;
    const created = await call('admin', 'post', '/api/users', {
      name: 'Temporary',
      email,
      phone: '',
      role: 'waiter',
      password: demoPassword,
    });
    expect(created.status).toBe(201);
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').set(json).send({ email, password: demoPassword });
    expect(login.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const toggled = await call('admin', 'post', `/api/users/${created.body.id}/toggle`, {});
    expect(toggled.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('allows an admin to update settings while every role reads invoice branding', async () => {
    const updated = await call('admin', 'put', '/api/settings', {
      restaurantName: `Dhaba House ${marker}`,
      phone: '+880 2 9000000',
      email: 'hello@dhabahouse.example',
      address: 'Dhaka, Bangladesh',
      currencySymbol: '৳',
      vatPercent: 5,
      serviceChargePercent: 10,
      invoicePrefix: 'INV-',
      paperSize: 'A4',
      receiptFooter: 'Thank you for dining with us.',
      lowStockDefault: 5,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.restaurant_name).toBe(`Dhaba House ${marker}`);
    for (const role of ROLES) {
      const response = await call(role, 'get', '/api/settings/invoice');
      expect(response.status, role).toBe(200);
      expect(response.body.restaurantName).toBe(`Dhaba House ${marker}`);
    }
  });
});
