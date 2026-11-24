import type Database from 'better-sqlite3';

const MAX_ATTEMPTS = 5;

export type SequenceName = 'order' | 'bill';

export interface NumberOptions {
  sequence: SequenceName;
  prefix: string;
  width?: number;
}

/** better-sqlite3 reports UNIQUE failures with SQLITE_CONSTRAINT_UNIQUE. */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

/**
 * Allocates the next number in an IMMEDIATE transaction. The counter increment
 * is committed before the caller's insert is attempted, so a UNIQUE collision
 * never rewinds the counter: the next attempt receives a fresh value.
 * `insert` itself runs in its own IMMEDIATE transaction for atomicity.
 */
export function withGeneratedNumber<T>(
  db: Database.Database,
  options: NumberOptions,
  insert: (number: string) => T
): T {
  const width = options.width ?? 4;
  const allocate = db.transaction((): string => {
    const row = db
      .prepare(
        'UPDATE number_sequences SET last_value = last_value + 1 WHERE name = ? RETURNING last_value'
      )
      .get(options.sequence) as { last_value: number } | undefined;

    if (!row) {
      throw new Error(`Missing number sequence: ${options.sequence}`);
    }
    return `${options.prefix}${String(row.last_value).padStart(width, '0')}`;
  });

  const runInsert = db.transaction((number: string) => insert(number));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const number = allocate.immediate();
    try {
      return runInsert.immediate(number);
    } catch (error) {
      if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }

  throw new Error(`Unable to allocate ${options.sequence} number after ${MAX_ATTEMPTS} attempts.`);
}

export function withOrderNumber<T>(db: Database.Database, insert: (number: string) => T): T {
  return withGeneratedNumber(db, { sequence: 'order', prefix: 'ORD-' }, insert);
}

export function withBillNumber<T>(db: Database.Database, insert: (number: string) => T): T {
  const row = db.prepare('SELECT invoice_prefix FROM settings WHERE id = 1').get() as
    | { invoice_prefix: string }
    | undefined;
  const prefix = row?.invoice_prefix || 'INV-';
  return withGeneratedNumber(db, { sequence: 'bill', prefix }, insert);
}
