import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from './db.ts';
import { LEGACY_ASSET_PREFIX, SCHEMA_VERSION, migrateLegacyAssetPaths, runMigrations } from './migrate.ts';

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
    expect(runMigrations(db)).toBe(1);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
    for (const table of ['users', 'settings', 'floors', 'tables', 'menu_categories', 'menu_items', 'item_variants', 'ingredients', 'recipe_items', 'orders', 'order_items', 'payments', 'stock_movements', 'daily_sales', 'schema_version', 'number_sequences']) {
      expect(names).toContain(table);
    }
    const version = db.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(version.version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('is idempotent across repeated calls and restarts', () => {
    const dbPath = path.join(tempDir, 'test.sqlite');
    const first = freshDb(dbPath);
    expect(runMigrations(first)).toBe(1);
    first.close();

    const second = freshDb(dbPath);
    expect(runMigrations(second)).toBe(0);
    expect(runMigrations(second)).toBe(0);
    second.close();
  });

  it('rejects a legacy retail database instead of overwriting it', () => {
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
