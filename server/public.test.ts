import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { closeDb, getDb, initDb } from './db.ts';
import { signTableToken } from './qr-token.ts';

type App = ReturnType<typeof createApp>;

const json = { 'Content-Type': 'application/json' };
const password = 'public-test-password-123456';

let app: App;
let server: ReturnType<App['listen']>;
let baseUrl: string;
let tempDir: string;
let manager: Agent;
let admin: Agent;
let tableToken: string;
let tableId: string;
let pendingOrderId: string;

function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => allKeys(entry, keys));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      allKeys(child, keys);
    }
  }
  return keys;
}

async function login(role: string): Promise<Agent> {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .set(json)
    .send({ email: `${role}@example.test`, password });
  expect(response.status).toBe(200);
  return agent;
}

async function newTable(): Promise<{ id: string; token: string }> {
  const created = await manager
    .post('/api/tables')
    .set(json)
    .send({ floorId: 'f1', number: `Q-${randomUUID().slice(0, 8)}`, seats: 4 });
  expect(created.status).toBe(201);
  const qr = await manager.get(`/api/tables/${created.body.id}/qr`);
  expect(qr.status).toBe(200);
  expect(qr.body.path).toBe(`/m/${qr.body.token}`);
  return { id: created.body.id, token: qr.body.token };
}

function orderBody(token: string, menuItemId = 'm1') {
  return {
    token,
    items: [{ menuItemId, quantity: 1, note: 'No onion' }],
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SEED_DEMO_DATA = 'true';
  process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-signing';
  process.env.QR_TOKEN_SECRET = 'test-only-qr-secret-that-is-long-enough';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  for (const role of ['admin', 'manager', 'waiter', 'kitchen', 'cashier']) {
    process.env[`${role.toUpperCase()}_EMAIL`] = `${role}@example.test`;
    process.env[`${role.toUpperCase()}_PASSWORD`] = password;
  }
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paynest-public-test-'));
  initDb(path.join(tempDir, 'test.sqlite'), { reset: true });
  app = createApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  manager = await login('manager');
  admin = await login('admin');
  const table = await newTable();
  tableId = table.id;
  tableToken = table.token;
});

afterAll(() => {
  server.close();
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('public QR menu', () => {
  it('returns only public menu fields for a valid signed token', async () => {
    const response = await request(app).get('/api/public/menu').query({ token: tableToken });
    expect(response.status).toBe(200);
    expect(response.body.restaurantName).toBeTruthy();
    expect(response.body.table.label).toContain('Table');
    expect(response.body.categories.length).toBeGreaterThan(0);
    expect(response.body.categories[0].items[0].price).toBeGreaterThan(0);

    const keys = allKeys(response.body);
    for (const privateKey of [
      'stock',
      'unit_cost',
      'cost',
      'costPrice',
      'recipe',
      'qr_secret_version',
      'floor_name',
      'opened_by',
      'created_by',
      'email',
      'phone',
      'role',
      'permissions',
      'version',
    ]) {
      expect(keys.has(privateKey)).toBe(false);
    }
  });

  it('rejects tampered, expired and rotated tokens', async () => {
    const tampered = `${tableToken.slice(0, -1)}${tableToken.endsWith('A') ? 'B' : 'A'}`;
    expect((await request(app).get('/api/public/menu').query({ token: tampered })).status).toBe(401);

    const expired = signTableToken(tableId, 1, Math.floor(Date.now() / 1000) - 60);
    expect((await request(app).get('/api/public/menu').query({ token: expired })).status).toBe(401);

    const { id, token } = await newTable();
    const rotated = await manager.post(`/api/tables/${id}/qr/rotate`).set(json).send({});
    expect(rotated.status).toBe(200);
    expect(rotated.body.token).not.toBe(token);
    expect((await request(app).get('/api/public/menu').query({ token })).status).toBe(401);
    expect((await request(app).get('/api/public/menu').query({ token: rotated.body.token })).status).toBe(200);
  });

  it('is not blocked by same-origin CORS checks', async () => {
    const response = await request(baseUrl)
      .get('/api/public/menu')
      .query({ token: tableToken })
      .set('Origin', baseUrl);
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(baseUrl);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('public orders', () => {
  it('ignores client prices and waits for waiter confirmation', async () => {
    const menu = await request(app).get('/api/public/menu').query({ token: tableToken });
    const item = menu.body.categories.flatMap((category: any) => category.items).find((entry: any) => entry.id === 'm1');
    const response = await request(app)
      .post('/api/public/orders')
      .set(json)
      .send({ ...orderBody(tableToken), price: 1, unitPrice: 1, lineTotal: 1, total: 1 });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending_confirmation');
    pendingOrderId = response.body.orderId;

    const line = getDb()
      .prepare('SELECT unit_price, line_total, notes FROM order_items WHERE order_id = ?')
      .get(pendingOrderId) as { unit_price: number; line_total: number; notes: string };
    expect(line.unit_price).toBe(item.price);
    expect(line.line_total).toBe(item.price);
    expect(line.notes).toBe('No onion');

    const tickets = await manager.get('/api/kitchen/tickets');
    expect(tickets.body.some((ticket: any) => ticket.order_id === pendingOrderId)).toBe(false);
    const bill = await manager.post(`/api/bills/orders/${pendingOrderId}/request`).set(json).send({});
    expect(bill.status).toBe(409);
    const edit = await manager.post(`/api/orders/${pendingOrderId}/items`).set(json).send({ menuItemId: 'm2', quantity: 1 });
    expect(edit.status).toBe(409);
  });

  it('returns only this table order status and hides private fields', async () => {
    const response = await request(app)
      .get(`/api/public/orders/${pendingOrderId}`)
      .query({ token: tableToken });
    expect(response.status).toBe(200);
    expect(response.body.orderId).toBe(pendingOrderId);
    expect(response.body.status).toBe('pending_confirmation');
    expect(response.body.items[0].name).toBeTruthy();
    const keys = allKeys(response.body);
    for (const privateKey of ['total', 'subtotal', 'opened_by', 'cost', 'stock', 'payment_status']) {
      expect(keys.has(privateKey)).toBe(false);
    }

    const other = await newTable();
    expect(
      (await request(app).get(`/api/public/orders/${pendingOrderId}`).query({ token: other.token })).status
    ).toBe(404);
  });

  it('lets a waiter confirm a guest order into the kitchen queue', async () => {
    const confirmed = await manager.post(`/api/orders/${pendingOrderId}/confirm`).set(json).send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('new');
    const status = await request(app)
      .get(`/api/public/orders/${pendingOrderId}`)
      .query({ token: tableToken });
    expect(status.body.status).toBe('new');
    const tickets = await manager.get('/api/kitchen/tickets');
    expect(tickets.body.some((ticket: any) => ticket.order_id === pendingOrderId)).toBe(true);
  });

  it('rejects unavailable items and non-JSON bodies', async () => {
    const db = getDb();
    const before = db.prepare('SELECT available FROM menu_items WHERE id = ?').get('m2') as { available: number };
    db.prepare('UPDATE menu_items SET available = 0 WHERE id = ?').run('m2');
    try {
      const response = await request(app).post('/api/public/orders').set(json).send(orderBody(tableToken, 'm2'));
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/not available/);
    } finally {
      db.prepare('UPDATE menu_items SET available = ? WHERE id = ?').run(before.available, 'm2');
    }

    const plain = await request(app)
      .post('/api/public/orders')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(orderBody(tableToken)));
    expect(plain.status).toBe(415);
  });

  it('caps orders per table per minute', async () => {
    const { token } = await newTable();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post('/api/public/orders').set(json).send(orderBody(token));
      expect(response.status).toBe(201);
    }
    const blocked = await request(app).post('/api/public/orders').set(json).send(orderBody(token));
    expect(blocked.status).toBe(429);
  });

  it('can auto-confirm guest orders when the setting is enabled', async () => {
    const current = await admin.get('/api/settings');
    const payload = {
      restaurantName: current.body.restaurant_name,
      phone: current.body.phone,
      email: current.body.email,
      address: current.body.address,
      currencySymbol: current.body.currency_symbol,
      vatPercent: current.body.vat_percent,
      serviceChargePercent: current.body.service_charge_percent,
      invoicePrefix: current.body.invoice_prefix,
      paperSize: current.body.paper_size,
      receiptFooter: current.body.receipt_footer,
      lowStockDefault: current.body.low_stock_default,
      autoConfirmPublicOrders: true,
    };
    const updated = await admin.put('/api/settings').set(json).send(payload);
    expect(updated.status).toBe(200);
    expect(updated.body.autoConfirmPublicOrders).toBe(true);
    try {
      const { token } = await newTable();
      const response = await request(app).post('/api/public/orders').set(json).send(orderBody(token));
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('new');
    } finally {
      await admin.put('/api/settings').set(json).send({ ...payload, autoConfirmPublicOrders: false });
    }
  });

  it('keeps authenticated staff routes protected', async () => {
    expect((await request(app).get('/api/tables')).status).toBe(401);
    expect((await request(app).get('/api/public/menu').query({ token: tableToken })).status).toBe(200);
  });
});
