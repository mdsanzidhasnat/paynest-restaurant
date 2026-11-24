import React, { useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { SaleInvoice } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface SalesHistoryViewProps {
  invoices: SaleInvoice[];
  onInspectInvoice: (invoice: SaleInvoice) => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  invoices,
  onInspectInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Due'>('All');

  const filtered = invoices.filter((inv) => {
    const matchStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter;
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.paymentMethod.toLowerCase().includes(q);
    return matchStatus && matchQ;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Sales History</h1>
        <p className="text-[13.5px] text-[#4B5563] mt-0.5">
          Complete invoice archive with payment method and receipt details
        </p>
      </div>

      <div className="pos-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-[320px]">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, customer, or method..."
            className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px]">
          {(['All', 'Paid', 'Due'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-3">Invoice #</th>
                <th className="py-3.5 px-3">Customer</th>
                <th className="py-3.5 px-3">Method</th>
                <th className="py-3.5 px-3 text-right">Amount</th>
                <th className="py-3.5 px-3 text-right">Profit</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3 text-right">Time</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => onInspectInvoice(inv)}
                  className="hover:bg-[#F6F8FB] cursor-pointer transition-colors"
                >
                  <td className="py-3.5 pl-6 pr-3 font-semibold text-[#4F46E5] tabular-nums">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-3 font-medium text-[#111827]">{inv.customerName}</td>
                  <td className="py-3.5 px-3 text-[#4B5563]">{inv.paymentMethod}</td>
                  <td className="py-3.5 px-3 text-right font-semibold text-[#111827] tabular-nums">
                    {formatBDT(inv.amount)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-medium text-[#10B981] tabular-nums">
                    +{formatBDT(inv.profit)}
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${
                        inv.paymentStatus === 'Paid'
                          ? 'bg-[#ECFDF5] text-[#059669]'
                          : 'bg-[#FFFBEB] text-[#D97706]'
                      }`}
                    >
                      {inv.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#9CA3AF] tabular-nums">
                    {inv.date} · {inv.time}
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectInvoice(inv);
                      }}
                      className="p-1.5 rounded-[8px] text-[#4B5563] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
                      aria-label={`Inspect ${inv.invoiceNumber}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
