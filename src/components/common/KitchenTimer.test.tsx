import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatElapsed, KitchenTimer } from './KitchenTimer';

const NOW = Date.parse('2026-11-24T12:00:00.000Z');

function createdAt(minutesAgo: number): string {
  return new Date(NOW - minutesAgo * 60_000).toISOString();
}

describe('formatElapsed', () => {
  it('formats minutes and hours from the item creation time', () => {
    expect(formatElapsed(createdAt(12), NOW)).toBe('12m');
    expect(formatElapsed(createdAt(65), NOW)).toBe('1h 05m');
  });

  it('clamps future and unparseable timestamps', () => {
    expect(formatElapsed(createdAt(-5), NOW)).toBe('0m');
    expect(formatElapsed('not-a-date', NOW)).toBe('0m');
  });
});

describe('KitchenTimer', () => {
  it('shows a fresh elapsed time without the late style', () => {
    render(<KitchenTimer createdAt={createdAt(12)} now={NOW} />);

    const timer = screen.getByLabelText('Elapsed 12m');
    expect(timer).toHaveTextContent('12m');
    expect(timer).not.toHaveClass('bg-[#FEF2F2]');
  });

  it('highlights an item that has been waiting too long', () => {
    render(<KitchenTimer createdAt={createdAt(65)} now={NOW} />);

    const timer = screen.getByLabelText('Elapsed 1h 05m');
    expect(timer).toHaveTextContent('1h 05m');
    expect(timer).toHaveClass('bg-[#FEF2F2]');
  });
});
