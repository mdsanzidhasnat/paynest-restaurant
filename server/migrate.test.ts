import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from './db.ts';
import { LEGACY_ASSET_PREFIX, SCHEMA_VERSION, migrateLegacyAssetPaths, runMigrations } from './migrate.ts';
import { getSchemaPath } from './paths.ts';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paynest-migrate-test-'));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function freshDb(file = ':memory:'): Database.Database {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  return db;
}

describe('restaurant schema migration', () => {
  it('creates the full schema from docs/schema.sql on an empty database', () => {
    const db = freshDb();
    expect(runMigrations(db)).toBe(SCHEMA_VERSION);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
    for (const table of ['users', 'settings', 'floors', 'tables', 'menu_categories', 'menu_items', 'item_variants', 'ingredients', 'recipe_items', 'orders', 'order_items', 'payments', 'stock_movements', 'bill_splits', 'order_item_events', 'table_transfers', 'daily_sales', 'schema_version', 'number_sequences']) {
      expect(names).toContain(table);
    }
    const version = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as { version: number };
    expect(version.version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('supports schema v4 public QR orders', () => {
    const db = freshDb();
    expect(runMigrations(db)).toBe(SCHEMA_VERSION);
    const settingsColumns = db.pragma('table_info(settings)') as Array<{ name: string }>;
    expect(settingsColumns.some((column) => column.name === 'auto_confirm_public_orders')).toBe(true);
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_table_status'").get()).toBeTruthy();
    db.prepare("INSERT INTO floors (id, name) VALUES ('f1', 'Ground')").run();
    db.prepare("INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1')").run();
    db.prepare(`
      INSERT INTO orders (id, order_number, table_id, source, status)
      VALUES ('o1', 'ORD-1', 't1', 'qr', 'pending_confirmation')
    `).run();
    expect((db.prepare('SELECT status FROM orders WHERE id = ?').get('o1') as { status: string }).status).toBe('pending_confirmation');
    db.close();
  });

  it('upgrades a v3 database and preserves existing orders', () => {
    const db = freshDb();
    const v3Schema = fs
      .readFileSync(getSchemaPath(), 'utf8')
      .split('\n')
      .filter((line) => !line.includes('auto_confirm_public_orders') && !line.includes('idx_orders_table_status'))
      .map((line) => line.replace("'pending_confirmation', ", ''))
      .join('\n');
    db.exec(v3Schema);
    const versions: Array<[number, string]> = [
      [1, 'initial restaurant schema and number sequences'],
      [2, 'bill splits, item status events, table transfers and cancel reason'],
      [3, 'one stock movement per ingredient per served item'],
    ];
    const insertVersion = db.prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)');
    for (const version of versions) insertVersion.run(...version);

    db.prepare("INSERT INTO floors (id, name) VALUES ('f1', 'Ground')").run();
    db.prepare("INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1')").run();
    db.prepare("INSERT INTO menu_categories (id, name) VALUES ('c1', 'Rice')").run();
    db.prepare("INSERT INTO menu_items (id, category_id, name, price) VALUES ('m1', 'c1', 'Rice', 10000)").run();
    db.prepare(`
      INSERT INTO orders (id, order_number, table_id, source, status)
      VALUES ('o1', 'ORD-1', 't1', 'qr', 'new')
    `).run();
    db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, status, unit_price, line_total)
      VALUES ('oi1', 'o1', 'm1', 'Rice', 2, 'new', 10000, 20000)
    `).run();

    expect(runMigrations(db)).toBe(1);
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get('o1')).toEqual({ status: 'new' });
    expect(db.prepare('SELECT quantity FROM order_items WHERE id = ?').get('oi1')).toEqual({ quantity: 2 });
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_table_status'").get()).toBeTruthy();
    db.prepare(`
      INSERT INTO orders (id, order_number, table_id, source, status)
      VALUES ('o2', 'ORD-2', 't1', 'qr', 'pending_confirmation')
    `).run();
    db.close();
  });

  it('is idempotent across repeated calls and restarts', () => {
    const dbPath = path.join(tempDir, 'test.sqlite');
    const first = freshDb(dbPath);
    expect(runMigrations(first)).toBe(SCHEMA_VERSION);
    first.close();

    const second = freshDb(dbPath);
    expect(runMigrations(second)).toBe(0);
    expect(runMigrations(second)).toBe(0);
    second.close();
  });

  it('rejects a non-restaurant database instead of overwriting it', () => {
    const db = freshDb();
    db.exec('CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);');
    expect(() => runMigrations(db)).toThrow(/not the restaurant schema/);
    db.close();
  });

  it('rewrites legacy asset paths exactly once', () => {
    const db = freshDb();
    runMigrations(db);
    db.prepare("INSERT INTO floors (id, name) VALUES ('f1', 'Ground')").run();
    db.prepare("INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1')").run();
    db.prepare("INSERT INTO menu_categories (id, name) VALUES ('c1', 'Rice')").run();
    db.prepare("INSERT INTO menu_items (id, category_id, name, image) VALUES ('m1', 'c1', 'Rice', ?)").run(`${LEGACY_ASSET_PREFIX}old.svg`);
    expect(migrateLegacyAssetPaths(db)).toBe(1);
    expect(migrateLegacyAssetPaths(db)).toBe(0);
    expect((db.prepare('SELECT image FROM menu_items WHERE id = ?').get('m1') as { image: string }).image).toBe('/images/old.svg');
    db.close();
  });

  it('enables foreign key enforcement on every initDb connection', () => {
    const dbPath = path.join(tempDir, 'pragmas.sqlite');
    const first = initDb(dbPath);
    expect(first.pragma('foreign_keys', { simple: true })).toBe(1);
    closeDb();
    const second = initDb(dbPath);
    expect(second.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(getDb()).toBe(second);
  });
});
