import { HttpError } from './errors.ts';

/**
 * Single source of truth for ingredient stock precision.
 *
 * Stock, recipe quantities and stock-movement deltas remain REAL numbers in
 * the existing schema and API. Every calculation rounds to three decimals
 * here, so repeated deductions cannot accumulate binary floating-point drift
 * such as 48 - 0.35 = 47.650000000000006.
 */
export const STOCK_DECIMALS = 3;
const STOCK_SCALE = 10 ** STOCK_DECIMALS;
const ROUNDING_EPSILON = 1e-9;

/** Rounds any stock quantity to at most three decimals and rejects invalid values. */
export function roundStockQuantity(value: unknown, label = 'Stock quantity'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `${label} must be a finite number.`);
  }
  const scaled = Math.round(Math.abs(value) * STOCK_SCALE + ROUNDING_EPSILON);
  if (!Number.isSafeInteger(scaled)) {
    throw new HttpError(400, `${label} is too large.`);
  }
  const rounded = value < 0 ? -scaled / STOCK_SCALE : scaled / STOCK_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Applies one stock change and returns the exact rounded result. A negative
 * result or a non-finite input is rejected before it can reach SQLite.
 */
export function applyStockChange(current: unknown, delta: unknown): number {
  const next = roundStockQuantity(
    roundStockQuantity(current, 'Current stock') + roundStockQuantity(delta, 'Stock change'),
    'Stock after change'
  );
  if (next < 0) throw new HttpError(409, 'Stock cannot become negative.');
  return next;
}
