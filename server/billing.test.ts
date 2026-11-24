import { describe, expect, it } from 'vitest';
import { calculateDue, calculateOrderTotals } from './billing.ts';

const settings = { vatPercent: 5, serviceChargePercent: 10 };

describe('server-owned billing calculations', () => {
  it('computes subtotal, VAT, service charge and total in minor units', () => {
    expect(calculateOrderTotals([{ quantity: 2, unitPrice: 55000 }], 0, settings)).toEqual({
      subtotal: 110000,
      discount: 0,
      vatAmount: 5500,
      serviceCharge: 11000,
      total: 126500,
    });
  });

  it('clamps discounts to the subtotal so totals can never be negative', () => {
    const result = calculateOrderTotals([{ quantity: 1, unitPrice: 10000 }], 999999, settings);
    expect(result.discount).toBe(10000);
    expect(result.total).toBe(0);
  });

  it('rejects negative, non-numeric and fractional money', () => {
    expect(() => calculateOrderTotals([{ quantity: 1, unitPrice: -1 }], 0, settings)).toThrow(/negative/);
    expect(() => calculateOrderTotals([{ quantity: 1, unitPrice: 1.5 }], 0, settings)).toThrow(/whole number/);
    expect(() => calculateOrderTotals([], '100', settings)).toThrow(/finite number/);
    expect(() => calculateOrderTotals([], 0, { vatPercent: 101, serviceChargePercent: 0 })).toThrow(/between 0 and 100/);
  });

  it('rejects non-positive quantities', () => {
    expect(() => calculateOrderTotals([{ quantity: 0, unitPrice: 100 }], 0, settings)).toThrow(/positive integer/);
  });

  it('never returns a negative due amount', () => {
    expect(calculateDue(10000, 4000)).toBe(6000);
    expect(calculateDue(10000, 12000)).toBe(0);
  });
});
