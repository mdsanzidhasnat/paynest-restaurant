/**
 * Shared money helpers for the restaurant app. Every amount handled here is an
 * INTEGER number of minor units (paisa). Authoritative totals are calculated by
 * `server/billing.ts`; the client uses these helpers only to format or parse
 * values it displays or sends back to the server.
 */

/** Rounds half-up to the nearest minor unit, avoiding float drift. */
export function roundMinorUnits(value: number): number {
  return Math.floor(value + 0.5);
}

/** Splits a total into whole minor units; the remainder goes to the last part. */
export function splitEqually(total: number, parts: number): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error('Total must be a non-negative whole number of minor units.');
  }
  if (!Number.isInteger(parts) || parts < 1 || parts > 100) {
    throw new Error('Split parts must be an integer between 1 and 100.');
  }
  const base = Math.floor(total / parts);
  const result = Array.from({ length: parts }, () => base);
  result[parts - 1] += total - base * parts;
  return result;
}

export function formatMoney(minorUnits: number, symbol = '৳'): string {
  const safe = Number.isFinite(minorUnits) ? minorUnits : 0;
  const major = safe / 100;
  const formatted = Number.isInteger(major)
    ? major.toLocaleString('en-US')
    : major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}

/**
 * Parses a taka amount typed by a user into minor units. Returns null for
 * anything invalid so callers can show a validation message instead of
 * sending a bad amount. No totals are computed here.
 */
export function parseMinorUnits(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [major, minor = ''] = trimmed.split('.');
  const value = Number(major) * 100 + Number(minor.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

/** Formats a short percentage for labels such as "VAT (5%)". */
export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Number.isInteger(safe) ? safe : Number(safe.toFixed(2))}%`;
}
