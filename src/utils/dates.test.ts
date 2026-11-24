import { describe, expect, it } from 'vitest';
import { dateRangeForPreset, formatLocalDate } from './dates';

describe('formatLocalDate', () => {
  it('pads local month and day parts', () => {
    expect(formatLocalDate(new Date(2026, 0, 3))).toBe('2026-01-03');
    expect(formatLocalDate(new Date(2026, 10, 21))).toBe('2026-11-21');
  });
});

describe('dateRangeForPreset', () => {
  const today = new Date(2026, 10, 21);

  it('uses today minus 6 days for the last 7 days', () => {
    expect(dateRangeForPreset('7d', today)).toEqual({
      startDate: '2026-11-15',
      endDate: '2026-11-21',
    });
  });

  it('uses today minus 13 days for the last 14 days', () => {
    expect(dateRangeForPreset('14d', today)).toEqual({
      startDate: '2026-11-08',
      endDate: '2026-11-21',
    });
  });

  it('uses today minus 29 days for the last 30 days', () => {
    expect(dateRangeForPreset('30d', today)).toEqual({
      startDate: '2026-10-23',
      endDate: '2026-11-21',
    });
  });

  it('crosses month and year boundaries using local dates', () => {
    expect(dateRangeForPreset('7d', new Date(2026, 0, 5))).toEqual({
      startDate: '2025-12-30',
      endDate: '2026-01-05',
    });
  });

  it('handles leap February in a 30-day range', () => {
    expect(dateRangeForPreset('30d', new Date(2024, 2, 1))).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-03-01',
    });
  });
});
