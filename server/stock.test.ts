import { describe, expect, it } from 'vitest';
import { applyStockChange, roundStockQuantity, STOCK_DECIMALS } from './stock.ts';

describe('stock quantity helper', () => {
  it('rounds stock values to the shared three-decimal precision', () => {
    expect(STOCK_DECIMALS).toBe(3);
    expect(roundStockQuantity(0.1 + 0.2)).toBe(0.3);
    expect(roundStockQuantity(48 - 0.35)).toBe(47.65);
    expect(roundStockQuantity(1.23456)).toBe(1.235);
    expect(roundStockQuantity(-0)).toBe(0);
  });

  it('deducts 0.35 kg one hundred times without float drift', () => {
    const perServing = roundStockQuantity(0.35);
    let stock = 48;
    for (let serving = 0; serving < 100; serving += 1) {
      stock = applyStockChange(stock, -perServing);
    }
    expect(stock).toBe(13);
    expect(Number(stock.toFixed(STOCK_DECIMALS))).toBe(13);
  });

  it('returns at most three decimals for restocking and serving', () => {
    expect(applyStockChange(47.65, 0.1)).toBe(47.75);
    expect(applyStockChange(47.75, -0.35)).toBe(47.4);
    expect(applyStockChange(1, -1)).toBe(0);
  });

  it('rejects negative stock, NaN, Infinity and non-numeric values', () => {
    expect(() => applyStockChange(0.3, -0.35)).toThrowError(/cannot become negative/i);
    expect(() => applyStockChange(Number.NaN, -1)).toThrowError(/finite number/i);
    expect(() => applyStockChange(1, Number.POSITIVE_INFINITY)).toThrowError(/finite number/i);
    expect(() => roundStockQuantity('1' as unknown as number)).toThrowError(/finite number/i);
  });
});
