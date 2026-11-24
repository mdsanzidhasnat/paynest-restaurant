import type { MenuItem } from '../../types/pos';
import { formatMoney } from '../../utils/money';
import { StatusBadge } from './StatusBadge';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onToggleAvailability?: (item: MenuItem) => void;
  canToggle?: boolean;
}

export function MenuItemCard({ item, onSelect, onToggleAvailability, canToggle }: MenuItemCardProps) {
  return (
    <div className="flex flex-col rounded-[12px] border border-[#E6EAF0] bg-white p-3 shadow-[0_1px_2px_rgba(17,24,39,0.03)]">
      <img
        src={item.image || '/images/dish_biryani.svg'}
        alt={item.name}
        className="h-28 w-full rounded-[9px] object-cover bg-[#F6F8FB]"
        loading="lazy"
      />
      <div className="mt-3">
        <p className="truncate text-[13.5px] font-semibold text-[#111827]">{item.name}</p>
        <p className="mt-0.5 line-clamp-2 min-h-[32px] text-[11px] text-[#9CA3AF]">
          {item.description || 'No description'}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold tabular-nums text-[#4F46E5]">
          {formatMoney(item.price)}
        </span>
        <StatusBadge status={item.available ? 'available' : 'unavailable'} />
      </div>
      {item.variants.length > 0 && (
        <p className="mt-1.5 truncate text-[11px] text-[#6B7280]">
          {item.variants.filter((variant) => variant.available).length} variants
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="flex-1 rounded-[9px] bg-[#4F46E5] px-2 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4338CA]"
        >
          Select
        </button>
        {canToggle && onToggleAvailability && (
          <button
            type="button"
            onClick={() => onToggleAvailability(item)}
            aria-label={`${item.available ? 'Disable' : 'Enable'} ${item.name}`}
            className="rounded-[9px] border border-[#E6EAF0] px-2 py-1.5 text-[11px] font-semibold text-[#4B5563] hover:bg-[#F6F8FB]"
          >
            {item.available ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
    </div>
  );
}
