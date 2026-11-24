import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { closeDb, initDb } from './db.ts';

let app: ReturnType<typeof createApp>;
let tempDir: string;
const demoPassword = randomBytes(18).toString('base64url');

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.SEED_DEMO_DATA = 'true';
  process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-signing';
  for (const key of ['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER']) {
    process.env[`${key}_PASSWORD`] = demoPassword;
    process.env[`${key}_EMAIL`] = `${key.toLowerCase()}@example.test`;
  }
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paynest-auth-test-'));
  initDb(path.join(tempDir, 'test.sqlite'), { reset: true });
  app = createApp();
});

afterAll(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('authentication with the five seeded roles', () => {
  it.each(['admin', 'manager', 'waiter', 'kitchen', 'cashier'])('logs in as %s and returns permissions', async (role) => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: `${role}@example.test`, password: demoPassword });
    expect(response.status).toBe(200);
    expect(response.body.role.toLowerCase()).toBe(role);
    expect(Array.isArray(response.body.permissions)).toBe(true);
    const cookie = response.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/paynest_token=/);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('restores a session with /api/auth/me and clears it on logout', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'admin@example.test', password: demoPassword });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('Admin');
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a bad password without issuing a cookie', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'admin@example.test', password: 'wrong-password' });
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
