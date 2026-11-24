import { useEffect, useState } from 'react';

/** Elapsed time since an item was fired, shown as `12m` or `1h 05m`. */
export function formatElapsed(createdAt: string, now: number = Date.now()): string {
  const started = Date.parse(createdAt);
  if (!Number.isFinite(started)) return '0m';
  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

interface KitchenTimerProps {
  createdAt: string;
  now?: number;
}

export function KitchenTimer({ createdAt, now }: KitchenTimerProps) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (now !== undefined) return;
    const timer = window.setInterval(() => setTick(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [now]);

  const elapsed = formatElapsed(createdAt, now ?? tick);
  const late = elapsed.includes('h') || parseInt(elapsed, 10) >= 30;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        late ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F3F4F6] text-[#4B5563]'
      }`}
      aria-label={`Elapsed ${elapsed}`}
    >
      {elapsed}
    </span>
  );
}
