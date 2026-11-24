import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { logStage, logWarn } from './log.ts';
import { getSchemaPath } from './paths.ts';

export const SCHEMA_VERSION = 3;
export const LEGACY_ASSET_PREFIX = '/src/assets/images/';
const PUBLIC_ASSET_PREFIX = '/images/';

// Only internal constants: table and column names are never request supplied.
const ASSET_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['menu_items', 'image'],
  ['users', 'avatar'],
];

interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

/**
 * Version 1 is the initial restaurant schema in docs/schema.sql. Later
 * versions are applied in order, once each, inside an IMMEDIATE transaction.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'initial restaurant schema and number sequences',
    up: (db) => {
      const insert = db.prepare(
        'INSERT OR IGNORE INTO number_sequences (name, last_value) VALUES (?, 0)'
      );
      insert.run('order');
      insert.run('bill');
    },
  },
  {
    version: 2,
    description: 'bill splits, item status events, table transfers and cancel reason',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS bill_splits (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
          label TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          method TEXT CHECK (method IN ('Cash', 'bKash', 'Nagad', 'Card')),
          reference TEXT NOT NULL DEFAULT '',
          paid_at TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          UNIQUE (order_id, label)
        );
        CREATE TABLE IF NOT EXISTS order_item_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
          from_status TEXT,
          to_status TEXT NOT NULL,
          actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE TABLE IF NOT EXISTS table_transfers (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          from_table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
          to_table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
          moved_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_bill_splits_order ON bill_splits(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_item_events_item ON order_item_events(order_item_id);
        CREATE INDEX IF NOT EXISTS idx_order_item_events_created ON order_item_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_table_transfers_order ON table_transfers(order_id);
        CREATE INDEX IF NOT EXISTS idx_table_transfers_to_table ON table_transfers(to_table_id);
      `);
      if (!hasColumn(db, 'order_items', 'cancel_reason')) {
        db.exec("ALTER TABLE order_items ADD COLUMN cancel_reason TEXT");
      }
    },
  },
  {
    version: 3,
    description: 'one stock movement per ingredient per served item',
    up: (db) => {
      db.exec(`
        CREATE TABLE stock_movements_v3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
          order_item_id TEXT REFERENCES order_items(id) ON DELETE RESTRICT,
          quantity REAL NOT NULL,
          reason TEXT NOT NULL CHECK (reason IN ('served', 'manual', 'waste', 'correction')),
          note TEXT NOT NULL DEFAULT '',
          created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          UNIQUE (order_item_id, ingredient_id, reason)
        );
        INSERT INTO stock_movements_v3 SELECT * FROM stock_movements;
        DROP TABLE stock_movements;
        ALTER TABLE stock_movements_v3 RENAME TO stock_movements;
        CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_order_item ON stock_movements(order_item_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by ON stock_movements(created_by);
      `);
    },
  },
];

function hasTable(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  return Boolean(row);
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return columns.some((entry) => entry.name === column);
}

function isFreshDatabase(db: Database.Database): boolean {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  return rows.length === 0;
}

/**
 * Creates the schema from docs/schema.sql on an empty database and applies
 * pending migrations in version order. Safe to call on every startup.
 */
export function runMigrations(db: Database.Database): number {
  db.pragma('foreign_keys = ON');

  if (!hasTable(db, 'schema_version')) {
    if (!isFreshDatabase(db)) {
      throw new Error(
        'Existing database is not the restaurant schema. Remove the old database file or set DB_PATH to a new path before starting.'
      );
    }
    db.exec(fs.readFileSync(getSchemaPath(), 'utf8'));
    logStage('Schema created from docs/schema.sql');
  }

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_version').all() as Array<{ version: number }>).map(
      (row) => row.version
    )
  );

  let count = 0;
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.transaction(() => {
      migration.up(db);
      db.prepare(
        'INSERT INTO schema_version (version, description) VALUES (?, ?)'
      ).run(migration.version, migration.description);
    }).immediate();
    logStage(`Applied migration ${migration.version}: ${migration.description}`);
    count += 1;
  }

  migrateLegacyAssetPaths(db);
  return count;
}

/**
 * Rewrites legacy image paths from the old product to self-contained paths in
 * public/images/. Idempotent: rows already using /images/ are not matched.
 */
export function migrateLegacyAssetPaths(db: Database.Database): number {
  let updated = 0;

  for (const [table, column] of ASSET_COLUMNS) {
    if (!hasTable(db, table) || !hasColumn(db, table, column)) {
      continue;
    }
    const result = db
      .prepare(`UPDATE ${table} SET ${column} = replace(${column}, ?, ?) WHERE ${column} LIKE ?`)
      .run(LEGACY_ASSET_PREFIX, PUBLIC_ASSET_PREFIX, `${LEGACY_ASSET_PREFIX}%`);
    updated += result.changes;
  }

  if (updated > 0) {
    logWarn(`Rewrote ${updated} legacy image path(s) to ${PUBLIC_ASSET_PREFIX}`);
  }
  return updated;
}
