import React, { useState } from 'react';
import { Phone, CheckCircle2 } from 'lucide-react';
import { Supplier } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface SuppliersViewProps {
  suppliers: Supplier[];
  onSettlePayable: (supplierId: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers, onSettlePayable }) => {
  const [notice, setNotice] = useState<string | null>(null);

  const handlePay = (sup: Supplier) => {
    onSettlePayable(sup.id);
    setNotice(`Settled payable balance for ${sup.company}`);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Suppliers</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Wholesale distributors and vendor payable balances
          </p>
        </div>
        {notice && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#ECFDF5] text-[#059669] text-[13px] font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {notice}
          </span>
        )}
      </div>

      <div className="pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-3">Distributor / Company</th>
                <th className="py-3.5 px-3">Contact Person</th>
                <th className="py-3.5 px-3">Phone</th>
                <th className="py-3.5 px-3">Supply Line</th>
                <th className="py-3.5 px-3 text-right">Last Supply</th>
                <th className="py-3.5 px-3 text-right">Payable</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {suppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-[#F6F8FB] transition-colors">
                  <td className="py-3.5 pl-6 pr-3 font-semibold text-[#111827]">{sup.company}</td>
                  <td className="py-3.5 px-3 text-[#4B5563]">{sup.contactName}</td>
                  <td className="py-3.5 px-3 text-[#4B5563] tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      {sup.phone}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-[#4B5563]">{sup.category}</td>
                  <td className="py-3.5 px-3 text-right text-[#9CA3AF] tabular-nums">{sup.lastSupply}</td>
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums">
                    {sup.payableAmount > 0 ? (
                      <span className="text-[#EF4444]">{formatBDT(sup.payableAmount)}</span>
                    ) : (
                      <span className="text-[#10B981]">Paid</span>
                    )}
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    {sup.payableAmount > 0 ? (
                      <button
                        type="button"
                        onClick={() => handlePay(sup)}
                        className="px-3 py-1.5 rounded-[8px] border border-[#E6EAF0] bg-white hover:border-[#4F46E5] hover:text-[#4F46E5] text-[12.5px] font-medium transition-colors whitespace-nowrap"
                      >
                        Record Payment
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-[#9CA3AF]">—</span>
                    )}
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
