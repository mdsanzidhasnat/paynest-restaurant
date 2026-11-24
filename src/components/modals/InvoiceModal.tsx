import React from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { SaleInvoice, StoreSettings } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface InvoiceModalProps {
  invoice: SaleInvoice | null;
  settings: StoreSettings;
  onClose: () => void;
  onMarkPaid: (invoiceId: string) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  settings,
  onClose,
  onMarkPaid,
}) => {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
      <div
        className="w-full max-w-[480px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
          <div>
            <h3 id="invoice-modal-title" className="text-[16px] font-semibold text-[#111827]">
              Invoice {invoice.invoiceNumber}
            </h3>
            <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 tabular-nums">
              {invoice.date} · {invoice.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[10px] text-[#4B5563] hover:bg-[#F6F8FB] transition-colors"
            aria-label="Close invoice modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Store & Customer Summary */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-[#E6EAF0]">
            <div>
              <p className="text-[14px] font-semibold text-[#111827]">{settings.storeName}</p>
              <p className="text-[12px] text-[#4B5563] mt-0.5">{settings.branchName}</p>
              <p className="text-[12px] text-[#9CA3AF] tabular-nums">{settings.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-[#9CA3AF]">Billed To</p>
              <p className="text-[14px] font-semibold text-[#111827] mt-0.5">{invoice.customerName}</p>
              <span
                className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-[6px] text-[11.5px] font-semibold ${
                  invoice.paymentStatus === 'Paid'
                    ? 'bg-[#ECFDF5] text-[#059669]'
                    : 'bg-[#FFFBEB] text-[#D97706]'
                }`}
              >
                {invoice.paymentStatus} · {invoice.paymentMethod}
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="grid grid-cols-12 text-[11.5px] font-semibold text-[#9CA3AF] pb-2 border-b border-[#F1F4F8]">
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Rate</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            <div className="divide-y divide-[#F6F8FB] max-h-[220px] overflow-y-auto">
              {invoice.items.map((item, idx) => (
                <div
                  key={`${item.productId}-${idx}`}
                  className="grid grid-cols-12 py-2.5 text-[13px] items-center"
                >
                  <span className="col-span-6 text-[#111827] font-medium pr-2 truncate">
                    {item.name}
                  </span>
                  <span className="col-span-2 text-center text-[#4B5563] tabular-nums">
                    {item.quantity}
                  </span>
                  <span className="col-span-2 text-right text-[#4B5563] tabular-nums">
                    {formatBDT(item.unitPrice)}
                  </span>
                  <span className="col-span-2 text-right font-semibold text-[#111827] tabular-nums">
                    {formatBDT(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="pt-3 border-t border-[#E6EAF0] space-y-1.5 text-[13px]">
            <div className="flex justify-between text-[#4B5563]">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">{formatBDT(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-[#10B981]">
                <span>Discount</span>
                <span className="tabular-nums font-medium">-{formatBDT(invoice.discount)}</span>
              </div>
            )}
            {invoice.vat > 0 && (
              <div className="flex justify-between text-[#4B5563]">
                <span>VAT</span>
                <span className="tabular-nums font-medium">{formatBDT(invoice.vat)}</span>
              </div>
            )}
            <div className="flex justify-between text-[15px] font-bold text-[#111827] pt-2 border-t border-dashed border-[#E6EAF0]">
              <span>Net Payable</span>
              <span className="tabular-nums text-[#4F46E5]">{formatBDT(invoice.amount)}</span>
            </div>
          </div>

          <p className="text-[11.5px] text-center text-[#9CA3AF] pt-1">{settings.receiptFooter}</p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F6F8FB] border-t border-[#E6EAF0] flex items-center justify-end gap-3">
          {invoice.paymentStatus === 'Due' && (
            <button
              type="button"
              onClick={() => onMarkPaid(invoice.id)}
              className="px-4 py-2 rounded-[10px] bg-[#10B981] hover:bg-[#059669] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark as Paid
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#111827] text-[13px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-[#4B5563]" />
            Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium transition-colors whitespace-nowrap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
