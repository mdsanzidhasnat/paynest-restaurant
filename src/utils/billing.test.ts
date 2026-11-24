import { describe, expect, it } from 'vitest';
import {
  calculateBilling,
  calculateDueAmount,
  calculateSubtotal,
  calculateVat,
  roundCurrency,
} from './billing';

const line = (sellPrice: number, quantity = 1) => ({
  product: { sellPrice },
  quantity,
});

describe('billing', () => {
  it('calculates a normal cart', () => {
    expect(calculateBilling([line(100, 2), line(50)], 0, 0)).toEqual({
      subtotal: 250,
      discount: 0,
      taxable: 250,
      vat: 0,
      total: 250,
    });
  });

  it('returns zero totals for an empty cart', () => {
    expect(calculateBilling([], 20, 5)).toEqual({
      subtotal: 0,
      discount: 0,
      taxable: 0,
      vat: 0,
      total: 0,
    });
  });

  it('reflects quantity changes in subtotal, VAT and total', () => {
    const cart = [line(32, 1)];

    expect(calculateSubtotal(cart)).toBe(32);
    expect(calculateVat(32, 5)).toBe(1.6);
    expect(calculateBilling(cart, 0, 5).total).toBe(33.6);

    cart[0].quantity = 3;

    expect(calculateSubtotal(cart)).toBe(96);
    expect(calculateVat(96, 5)).toBe(4.8);
    expect(calculateBilling(cart, 0, 5).total).toBe(100.8);
  });

  it('supports fixed and percentage discounts', () => {
    expect(calculateBilling([line(100, 2)], 10, 5)).toEqual({
      subtotal: 200,
      discount: 10,
      taxable: 190,
      vat: 9.5,
      total: 199.5,
    });

    const percentageTotals = {
      subtotal: 200,
      discount: 20,
      taxable: 180,
      vat: 9,
      total: 189,
    };

    expect(calculateBilling([line(100, 2)], 10, 5, 'percentage')).toEqual(percentageTotals);
    expect(calculateBilling([line(100, 2)], '10%', 5)).toEqual(percentageTotals);
  });

  it('subtracts the discount before calculating VAT', () => {
    expect(calculateBilling([line(100, 2)], 25, 10)).toEqual({
      subtotal: 200,
      discount: 25,
      taxable: 175,
      vat: 17.5,
      total: 192.5,
    });
  });

  it('calculates VAT at the selected rate and rounds to 2 decimals', () => {
    expect(calculateBilling([line(100)], 0, 5)).toEqual({
      subtotal: 100,
      discount: 0,
      taxable: 100,
      vat: 5,
      total: 105,
    });

    expect(calculateBilling([line(33.33, 3)], 0, 7.5)).toEqual({
      subtotal: 99.99,
      discount: 0,
      taxable: 99.99,
      vat: 7.5,
      total: 107.49,
    });
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it('clamps a discount that is larger than the subtotal', () => {
    expect(calculateBilling([line(100)], 500, 5)).toEqual({
      subtotal: 100,
      discount: 100,
      taxable: 0,
      vat: 0,
      total: 0,
    });
  });

  it('calculates the full due amount and partial payments', () => {
    expect(calculateDueAmount(236.25, 0)).toBe(236.25);
    expect(calculateDueAmount(236.25, 100.5)).toBe(135.75);
    expect(calculateDueAmount(236.25, 300)).toBe(0);
    expect(calculateDueAmount('236.25', '-5')).toBe(236.25);
  });
});
