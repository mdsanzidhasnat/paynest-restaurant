import type { ReactNode } from 'react';
import type { BillView } from '../../types/pos';
import { formatMoney, formatPercent } from '../../utils/money';

interface BillSummaryProps {
  bill: BillView;
  tableNumber?: string;
  children?: ReactNode;
}

export function BillSummary({ bill, tableNumber, children }: BillSummaryProps) {
  const symbol = bill.settings.currencySymbol;
  const money = (value: number) => formatMoney(value, symbol);

  return (
    <div className="print-invoice-card rounded-[12px] border border-[#E6EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(17,24,39,0.03)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#E6EAF0] pb-4">
        <div>
          <p className="text-[16px] font-bold text-[#111827]">{bill.settings.restaurantName}</p>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">
            {bill.settings.address}
            {bill.settings.phone && ` · ${bill.settings.phone}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold text-[#111827]">
            {bill.order.billNumber ?? bill.order.orderNumber}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">
            {tableNumber ? `Table ${tableNumber}` : bill.order.orderNumber}
          </p>
        </div>
      </div>

      <table className="mt-4 w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-[#F1F4F8] text-[10px] uppercase tracking-wide text-[#9CA3AF]">
            <th className="pb-2 font-semibold">Item</th>
            <th className="pb-2 text-right font-semibold">Qty</th>
            <th className="pb-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F4F8]">
          {bill.lines.filter((line) => line.status !== 'cancelled').map((line) => (
            <tr key={line.id}>
              <td className="py-2 text-[#374151]">
                {line.name}
                {line.variantName && (
                  <span className="text-[#9CA3AF]"> ({line.variantName})</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums text-[#6B7280]">{line.quantity}</td>
              <td className="py-2 text-right tabular-nums text-[#111827]">{money(line.lineTotal)}</td>
            </tr>
          ))}
          {bill.lines.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-[#9CA3AF]">
                No items on this bill.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <dl className="mt-4 space-y-1.5 border-t border-[#E6EAF0] pt-4 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">Subtotal</dt>
          <dd className="tabular-nums text-[#111827]">{money(bill.totals.subtotal)}</dd>
        </div>
        {bill.totals.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#6B7280]">Discount</dt>
            <dd className="tabular-nums text-[#EF4444]">−{money(bill.totals.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">VAT ({formatPercent(bill.settings.vatPercent)})</dt>
          <dd className="tabular-nums text-[#111827]">{money(bill.totals.vatAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">
            Service charge ({formatPercent(bill.settings.serviceChargePercent)})
          </dt>
          <dd className="tabular-nums text-[#111827]">{money(bill.totals.serviceCharge)}</dd>
        </div>
        <div className="flex justify-between border-t border-[#E6EAF0] pt-2 text-[15px] font-bold">
          <dt className="text-[#111827]">Total</dt>
          <dd className="tabular-nums text-[#111827]">{money(bill.totals.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">Paid</dt>
          <dd className="tabular-nums text-[#047857]">{money(bill.paid)}</dd>
        </div>
        <div className="flex justify-between text-[13px] font-semibold">
          <dt className="text-[#6B7280]">Due</dt>
          <dd className="tabular-nums text-[#B91C1C]">{money(bill.due)}</dd>
        </div>
      </dl>

      {bill.settings.receiptFooter && (
        <p className="mt-5 border-t border-dashed border-[#E6EAF0] pt-3 text-center text-[11px] text-[#9CA3AF]">
          {bill.settings.receiptFooter}
        </p>
      )}

      {children && <div className="mt-5 no-print">{children}</div>}
    </div>
  );
}
