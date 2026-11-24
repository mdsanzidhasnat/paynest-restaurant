import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getDbPath } from './config.ts';
import { logStage, logWarn } from './log.ts';
import { runMigrations } from './migrate.ts';
import { resolveProjectPath } from './paths.ts';
import { isDatabaseEmpty, seedDatabase } from './seed.ts';

let database: Database.Database | null = null;

export function initDb(
  dbPath: string = getDbPath(),
  options: { seed?: boolean; reset?: boolean } = {}
): Database.Database {
  if (database) {
    database.close();
    database = null;
  }

  const resolvedPath = resolveProjectPath(dbPath);
  const dataDir = path.dirname(resolvedPath);
  logStage(`DB path resolved: ${resolvedPath}`);
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(resolvedPath);
  database = db;
  logStage(`Database opened: ${resolvedPath}`);

  db.pragma('foreign_keys = ON');
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
    db.pragma('journal_mode = WAL');
  } catch {
    logWarn(`Data directory ${dataDir} is not writable; continuing without WAL.`);
  }

  runMigrations(db);

  if (options.reset) {
    seedDatabase(db, { replace: true });
  } else if (options.seed || isDatabaseEmpty(db)) {
    // seedDatabase re-checks that the users table is empty before inserting.
    seedDatabase(db);
  }

  return db;
}

export function getDb(): Database.Database {
  if (!database) {
    throw new Error('Database is not initialized. Call initDb() first.');
  }
  return database;
}

export function closeDb(): void {
  if (database) {
    database.close();
    database = null;
  }
}
