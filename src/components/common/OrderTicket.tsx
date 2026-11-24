import { ClipboardList, Users } from 'lucide-react';
import type { RestaurantOrder } from '../../types/pos';
import { formatMoney } from '../../utils/money';
import { StatusBadge } from './StatusBadge';

interface OrderTicketProps {
  order: RestaurantOrder;
  tableNumber?: string;
  onConfirm?: (order: RestaurantOrder) => void;
  onOpen?: (order: RestaurantOrder) => void;
}

export function OrderTicket({ order, tableNumber, onConfirm, onOpen }: OrderTicketProps) {
  const pending = order.status === 'pending_confirmation';

  return (
    <div className="rounded-[12px] border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#4F46E5] stroke-[1.75]" />
            <p className="text-[14px] font-bold text-[#111827]">{order.orderNumber}</p>
          </div>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            {tableNumber ? `Table ${tableNumber}` : 'Guest order'}
            {order.guestCount > 0 && (
              <span className="inline-flex items-center gap-1 ml-2">
                <Users className="h-3 w-3 stroke-[1.75]" />
                {order.guestCount}
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={order.status} kind="order" />
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-[#F1F4F8] pt-3">
        {order.items.length === 0 ? (
          <li className="text-[12px] text-[#9CA3AF]">No items yet.</li>
        ) : (
          order.items
            .filter((line) => line.status !== 'cancelled')
            .map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 truncate text-[#374151]">
                  <span className="font-semibold tabular-nums text-[#111827]">{line.quantity}×</span>{' '}
                  {line.name}
                  {line.variantName && (
                    <span className="text-[#6B7280]"> ({line.variantName})</span>
                  )}
                </span>
                <span className="tabular-nums text-[#4B5563]">{formatMoney(line.lineTotal)}</span>
              </li>
            ))
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-[#F1F4F8] pt-3">
        <span className="text-[12px] font-medium text-[#6B7280]">Server total</span>
        <span className="text-[14px] font-bold tabular-nums text-[#111827]">
          {formatMoney(order.total)}
        </span>
      </div>

      {(onConfirm || onOpen) && (
        <div className="mt-4 flex gap-2">
          {onOpen && (
            <button
              type="button"
              onClick={() => onOpen(order)}
              className="rounded-[9px] border border-[#E6EAF0] px-3 py-1.5 text-[12px] font-semibold text-[#4B5563] hover:bg-[#F6F8FB]"
            >
              Open
            </button>
          )}
          {pending && onConfirm && (
            <button
              type="button"
              onClick={() => onConfirm(order)}
              className="rounded-[9px] bg-[#4F46E5] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4338CA]"
            >
              Confirm order
            </button>
          )}
        </div>
      )}
    </div>
  );
}
