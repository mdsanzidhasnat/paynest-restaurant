import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from './db.ts';
import { withBillNumber, withOrderNumber } from './numbering.ts';

let tempDir: string;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.SEED_DEMO_DATA = 'false';
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paynest-numbering-test-'));
  initDb(path.join(tempDir, 'test.sqlite'));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('atomic bill and order numbering', () => {
  it('allocates strictly increasing unique numbers', () => {
    const db = getDb();
    db.exec("INSERT INTO floors (id, name) VALUES ('f1', 'Ground'); INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1'); INSERT INTO users (id, name, email, role, password_hash) VALUES ('u1', 'Owner', 'o@example.com', 'admin', 'hash');");
    const numbers = Array.from({ length: 25 }, (_, index) =>
      withOrderNumber(db, (number) => {
        db.prepare("INSERT INTO orders (id, order_number, table_id, source, opened_by) VALUES (?, ?, ?, 'waiter', 'u1')").run(`o${index}`, number, 't1');
        return number;
      })
    );
    expect(new Set(numbers).size).toBe(25);
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, index) => `ORD-${String(index + 1).padStart(4, '0')}`));
  });

  it('rolls back the counter when the insert fails and retries on UNIQUE conflicts', () => {
    const db = getDb();
    db.exec("INSERT INTO floors (id, name) VALUES ('f1', 'Ground'); INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1'); INSERT INTO users (id, name, email, role, password_hash) VALUES ('u1', 'Owner', 'o@example.com', 'admin', 'hash'); INSERT INTO orders (id, order_number, table_id, source, opened_by) VALUES ('existing', 'ORD-0002', 't1', 'waiter', 'u1'); UPDATE number_sequences SET last_value = 1 WHERE name = 'order';");
    // First attempt collides with ORD-0002; the retry receives ORD-0003.
    const number = withOrderNumber(db, (candidate) => {
      db.prepare("INSERT INTO orders (id, order_number, table_id, source, opened_by) VALUES (?, ?, ?, 'waiter', 'u1')").run(`o-${candidate}`, candidate, 't1');
      return candidate;
    });
    expect(number).toBe('ORD-0003');
    const sequence = db.prepare("SELECT last_value FROM number_sequences WHERE name = 'order'").get() as { last_value: number };
    expect(sequence.last_value).toBe(3);
  });

  it('handles concurrent-style creation from many database handles without duplicates or gaps', () => {
    const dbPath = path.join(tempDir, 'concurrent.sqlite');
    closeDb();
    fs.rmSync(path.join(tempDir, 'test.sqlite'), { force: true });
    initDb(dbPath);
    getDb().exec("INSERT INTO floors (id, name) VALUES ('f1', 'Ground'); INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1'); INSERT INTO users (id, name, email, role, password_hash) VALUES ('u1', 'Owner', 'o@example.com', 'admin', 'hash');");

    const handles = Array.from({ length: 6 }, () => {
      const handle = new Database(dbPath);
      handle.pragma('foreign_keys = ON');
      handle.pragma('busy_timeout = 5000');
      return handle;
    });
    const token = randomBytes(4).toString('hex');
    const results: string[] = [];
    try {
      for (let round = 0; round < 8; round += 1) {
        const batch = handles.map((handle, index) =>
          withOrderNumber(handle, (number) => {
            handle.prepare("INSERT INTO orders (id, order_number, table_id, source, opened_by) VALUES (?, ?, ?, 'waiter', 'u1')").run(`${token}-${round}-${index}`, number, 't1');
            return number;
          })
        );
        results.push(...batch);
      }
    } finally {
      handles.forEach((handle) => handle.close());
    }
    expect(new Set(results).size).toBe(results.length);
    expect(results.length).toBe(48);
    expect(results.sort()).toEqual(Array.from({ length: 48 }, (_, index) => `ORD-${String(index + 1).padStart(4, '0')}`).sort());
  });

  it('uses the configured invoice prefix for bills', () => {
    const db = getDb();
    db.prepare("INSERT INTO settings (id, restaurant_name) VALUES (1, 'Test')").run();
    const number = withBillNumber(db, (candidate) => candidate);
    expect(number).toBe('INV-0001');
    db.prepare("UPDATE settings SET invoice_prefix = 'BILL-' WHERE id = 1").run();
    expect(withBillNumber(db, (candidate) => candidate)).toBe('BILL-0002');
  });
});
