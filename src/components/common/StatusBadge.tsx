import type { OrderItemStatus, OrderStatus, TableStatus } from '../../types/pos';

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'indigo';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
  green: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  amber: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  red: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  blue: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  indigo: 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]',
};

const LABELS: Record<string, string> = {
  free: 'Free',
  occupied: 'Occupied',
  bill_pending: 'Bill pending',
  pending_confirmation: 'Awaiting confirmation',
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  closed: 'Closed',
  cancelled: 'Cancelled',
  unpaid: 'Unpaid',
  paid: 'Paid',
  void: 'Void',
  low: 'Low stock',
  available: 'Available',
  unavailable: 'Unavailable',
};

const TABLE_TONES: Record<TableStatus, Tone> = {
  free: 'green',
  occupied: 'amber',
  bill_pending: 'red',
};

const ORDER_TONES: Record<OrderStatus, Tone> = {
  pending_confirmation: 'red',
  new: 'blue',
  preparing: 'amber',
  ready: 'indigo',
  served: 'green',
  closed: 'neutral',
};

const ITEM_TONES: Record<OrderItemStatus, Tone> = {
  new: 'blue',
  preparing: 'amber',
  ready: 'indigo',
  served: 'green',
  cancelled: 'neutral',
};

interface StatusBadgeProps {
  status: string;
  kind?: 'table' | 'order' | 'item' | 'generic';
  label?: string;
  low?: boolean;
}

export function StatusBadge({ status, kind = 'generic', label, low }: StatusBadgeProps) {
  let tone: Tone = 'neutral';
  if (kind === 'table') tone = TABLE_TONES[status as TableStatus] ?? 'neutral';
  else if (kind === 'order') tone = ORDER_TONES[status as OrderStatus] ?? 'neutral';
  else if (kind === 'item') tone = ITEM_TONES[status as OrderItemStatus] ?? 'neutral';
  else if (status === 'low') tone = 'red';
  else if (status === 'available') tone = 'green';
  else if (status === 'unavailable') tone = 'neutral';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}
    >
      {label ?? (low ? LABELS.low : LABELS[status] ?? status)}
    </span>
  );
}
