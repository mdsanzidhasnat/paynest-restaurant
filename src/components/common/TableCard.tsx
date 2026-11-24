import { ArrowRightLeft, Users } from 'lucide-react';
import type { RestaurantTable } from '../../types/domain';
import { StatusBadge } from './StatusBadge';

interface TableCardProps {
  table: RestaurantTable;
  selected?: boolean;
  canTransfer?: boolean;
  onOpen: (table: RestaurantTable) => void;
  onTransfer?: (table: RestaurantTable) => void;
}

export function TableCard({ table, selected, canTransfer, onOpen, onTransfer }: TableCardProps) {
  const occupied = table.status !== 'free';

  return (
    <div
      className={`rounded-[12px] border bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)] transition-colors ${
        selected ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/15' : 'border-[#E6EAF0] hover:border-[#C7D2FE]'
      }`}
      data-testid={`table-card-${table.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold text-[#111827]">Table {table.number}</p>
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{table.floorName || 'Unassigned'}</p>
        </div>
        <StatusBadge status={table.status} kind="table" />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[12px] text-[#6B7280]">
        <Users className="h-3.5 w-3.5 stroke-[1.75]" />
        <span>{table.seats} seats</span>
        <span className="mx-1 text-[#D1D5DB]">•</span>
        <span className="capitalize">{table.shape}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={`${occupied ? 'View order for' : 'Open'} table ${table.number}`}
          onClick={() => onOpen(table)}
          className="rounded-[9px] bg-[#4F46E5] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4338CA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
        >
          {occupied ? 'View order' : 'Open table'}
        </button>
        {canTransfer && occupied && onTransfer && (
          <button
            type="button"
            aria-label={`Transfer table ${table.number}`}
            onClick={() => onTransfer(table)}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#E6EAF0] px-3 py-1.5 text-[12px] font-semibold text-[#4B5563] hover:bg-[#F6F8FB]"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 stroke-[1.75]" />
            Transfer
          </button>
        )}
      </div>
    </div>
  );
}
