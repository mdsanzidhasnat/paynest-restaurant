/**
 * Server-owned money calculations. All amounts are INTEGER minor units (paisa).
 * Client-supplied totals are never accepted; only quantities, unit prices and
 * a discount amount are inputs, and every value is validated and clamped here.
 */

import { roundMinorUnits, splitEqually } from '../src/utils/money.ts';

// Re-exported so existing server imports keep a single authoritative source.
export { roundMinorUnits, splitEqually } from '../src/utils/money.ts';

export interface BillableLine {
  quantity: number;
  unitPrice: number;
}

export interface BillingSettings {
  vatPercent: number;
  serviceChargePercent: number;
}

export interface DiscountInput {
  type: 'none' | 'fixed' | 'percent';
  value: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  vatAmount: number;
  serviceCharge: number;
  total: number;
}

const MAX_SAFE_MINOR_UNITS = Number.MAX_SAFE_INTEGER;

function assertMinorUnits(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number of minor units.`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  if (value > MAX_SAFE_MINOR_UNITS) {
    throw new Error(`${label} is too large.`);
  }
  return value;
}

function assertPercent(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
  return value;
}

/** Sums price snapshots into a subtotal; rejects client-style money values. */
export function calculateSubtotal(lines: readonly BillableLine[]): number {
  return calculateOrderTotals(lines, 0, { vatPercent: 0, serviceChargePercent: 0 }).subtotal;
}

/**
 * Reports whether a requested discount is larger than a role cap. The route
 * can reject an over-limit request while the calculation below still clamps
 * every stored amount as a defence in depth.
 */
export function discountExceedsCap(
  subtotal: number,
  input: DiscountInput,
  maxPercent = 100
): boolean {
  const safeSubtotal = assertMinorUnits(subtotal, 'Subtotal');
  const capPercent = assertPercent(maxPercent, 'Discount cap');
  if (input.type === 'percent') {
    return typeof input.value === 'number' && input.value > capPercent;
  }
  if (input.type === 'fixed') {
    return assertMinorUnits(input.value, 'Discount') > Math.floor((safeSubtotal * capPercent) / 100);
  }
  return false;
}

/**
 * Resolves a fixed or percentage discount into minor units. The result is
 * always clamped to 0..subtotal; an optional role cap (e.g. cashier 10%) is
 * applied to both discount types before the final clamp.
 */
export function resolveDiscountAmount(
  subtotal: number,
  input: DiscountInput,
  maxPercent = 100
): number {
  const safeSubtotal = assertMinorUnits(subtotal, 'Subtotal');
  const cap = Math.floor((safeSubtotal * assertPercent(maxPercent, 'Discount cap')) / 100);
  if (input.type === 'none' || input.value === 0) return 0;
  if (input.type === 'fixed') {
    return Math.min(assertMinorUnits(input.value, 'Discount'), safeSubtotal, cap);
  }
  if (input.type !== 'percent') {
    throw new Error('Discount type must be none, fixed or percent.');
  }
  if (typeof input.value !== 'number' || !Number.isFinite(input.value) || input.value < 0) {
    throw new Error('Discount percentage must be a non-negative number.');
  }
  // Out-of-range percentages are clamped rather than rejected: the server must
  // never trust a client value, but a bad value cannot break bill creation.
  return Math.min(roundMinorUnits((safeSubtotal * input.value) / 100), safeSubtotal, cap);
}

/** Full bill calculation; the only supported money pipeline for new bills. */
export function calculateBill(
  lines: readonly BillableLine[],
  discount: DiscountInput,
  settings: BillingSettings,
  maxDiscountPercent = 100
): OrderTotals {
  const subtotal = calculateSubtotal(lines);
  const amount = resolveDiscountAmount(subtotal, discount, maxDiscountPercent);
  return calculateOrderTotals(lines, amount, settings);
}

/**
 * Computes every money field for an order. The discount is clamped to the
 * subtotal so a client can never produce a negative total.
 */
export function calculateOrderTotals(
  lines: readonly BillableLine[],
  requestedDiscount: unknown,
  settings: BillingSettings
): OrderTotals {
  if (!Array.isArray(lines)) {
    throw new Error('Order lines must be an array.');
  }

  let subtotal = 0;
  for (const line of lines) {
    if (!line || typeof line !== 'object') {
      throw new Error('Each order line must be an object.');
    }
    const quantity = line.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Line quantity must be a positive integer.');
    }
    const unitPrice = assertMinorUnits(line.unitPrice, 'Unit price');
    const lineTotal = unitPrice * quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new Error('Line total is too large.');
    }
    subtotal += lineTotal;
  }
  if (!Number.isSafeInteger(subtotal)) {
    throw new Error('Subtotal is too large.');
  }

  const discount = Math.min(assertMinorUnits(requestedDiscount, 'Discount'), subtotal);
  const taxable = subtotal - discount;
  const vatPercent = assertPercent(settings.vatPercent, 'VAT percentage');
  const serviceChargePercent = assertPercent(
    settings.serviceChargePercent,
    'Service charge percentage'
  );

  const vatAmount = roundMinorUnits((taxable * vatPercent) / 100);
  const serviceCharge = roundMinorUnits((taxable * serviceChargePercent) / 100);
  const total = taxable + vatAmount + serviceCharge;
  if (!Number.isSafeInteger(total)) {
    throw new Error('Order total is too large.');
  }

  return { subtotal, discount, vatAmount, serviceCharge, total };
}

/** Money still due after a recorded payment amount (also server-owned). */
export function calculateDue(total: number, paidAmount: number): number {
  const safeTotal = assertMinorUnits(total, 'Total');
  const safePaid = assertMinorUnits(paidAmount, 'Paid amount');
  return Math.max(0, safeTotal - safePaid);
}
