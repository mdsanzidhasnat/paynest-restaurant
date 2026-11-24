export type DateRangePreset = '7d' | '14d' | '30d';

const PRESET_DAYS: Record<DateRangePreset, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

/** Format a Date using local calendar parts, avoiding UTC shifts from toISOString(). */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Inclusive local-date range ending today: the last 7/14/30 days, including today.
 * An optional `today` keeps the helper deterministic in tests.
 */
export function dateRangeForPreset(
  preset: DateRangePreset,
  today: Date = new Date()
): { startDate: string; endDate: string } {
  const days = PRESET_DAYS[preset];
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (days - 1)
  );
  return { startDate: formatLocalDate(start), endDate: formatLocalDate(today) };
}
