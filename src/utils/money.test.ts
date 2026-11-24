import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, parseMinorUnits, roundMinorUnits, splitEqually } from './money';

describe('money utility', () => {
  it('formats integer minor units as taka', () => {
    expect(formatMoney(0)).toBe('৳0');
    expect(formatMoney(45000)).toBe('৳450');
    expect(formatMoney(55000)).toBe('৳550');
    expect(formatMoney(123)).toBe('৳1.23');
    expect(formatMoney(1234567)).toBe('৳12,345.67');
    expect(formatMoney(-250)).toBe('৳-2.50');
    expect(formatMoney(1000, 'Tk ')).toBe('Tk 10');
  });

  it('parses user-entered taka into whole minor units', () => {
    expect(parseMinorUnits('450')).toBe(45000);
    expect(parseMinorUnits('450.5')).toBe(45050);
    expect(parseMinorUnits(' 12.09 ')).toBe(1209);
    expect(parseMinorUnits('0')).toBe(0);
    expect(parseMinorUnits('-5')).toBeNull();
    expect(parseMinorUnits('12.345')).toBeNull();
    expect(parseMinorUnits('abc')).toBeNull();
    expect(parseMinorUnits('')).toBeNull();
  });

  it('rounds minor units half-up', () => {
    expect(roundMinorUnits(10.4)).toBe(10);
    expect(roundMinorUnits(10.5)).toBe(11);
  });

  it('splits a total without losing paisa', () => {
    expect(splitEqually(1000, 3)).toEqual([333, 333, 334]);
    expect(() => splitEqually(1000, 0)).toThrow();
    expect(() => splitEqually(-1, 2)).toThrow();
  });

  it('formats percentages', () => {
    expect(formatPercent(5)).toBe('5%');
    expect(formatPercent(7.5)).toBe('7.5%');
  });
});
