import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { logStage, logWarn } from './log.ts';
import { getSchemaPath } from './paths.ts';

export const SCHEMA_VERSION = 1;
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
