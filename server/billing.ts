/**
 * Server-owned money calculations. All amounts are INTEGER minor units (paisa).
 * Client-supplied totals are never accepted; only quantities, unit prices and
 * a discount amount are inputs, and every value is validated and clamped here.
 */

export interface BillableLine {
  quantity: number;
  unitPrice: number;
}

export interface BillingSettings {
  vatPercent: number;
  serviceChargePercent: number;
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

/** Rounds half-up to the nearest minor unit, avoiding float drift. */
function roundMinorUnits(value: number): number {
  return Math.floor(value + 0.5);
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
