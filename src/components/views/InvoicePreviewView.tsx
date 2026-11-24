import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Mail,
  MessageCircle,
  Printer,
  Send,
  X,
} from 'lucide-react';
import { Customer, SaleInvoice, StoreSettings } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface InvoicePreviewViewProps {
  invoice: SaleInvoice;
  allInvoices: SaleInvoice[];
  customers: Customer[];
  settings: StoreSettings;
  onSelectInvoice: (invoice: SaleInvoice) => void;
  onBack: () => void;
  onMarkPaid: (invoiceId: string) => void;
}

// Deterministic crisp 21x21 QR SVG matrix seeded by invoice number
function generateQrMatrix(seed: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rowOffset + r][colOffset + c] = isBorder || isCenter;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      if (r === 6 || c === 6) {
        grid[r][c] = (r + c) % 2 === 0;
        continue;
      }
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = (hash >>> 0) % 3 !== 0;
    }
  }
  return grid;
}

export const InvoicePreviewView: React.FC<InvoicePreviewViewProps> = ({
  invoice,
  allInvoices,
  customers,
  settings,
  onSelectInvoice,
  onBack,
  onMarkPaid,
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<'whatsapp' | 'email' | null>(null);
  const [recipientInput, setRecipientInput] = useState('');

  const customer = customers.find((c) => c.id === invoice.customerId);
  const qrMatrix = useMemo(
    () => generateQrMatrix(`${invoice.invoiceNumber}-${invoice.amount}-${invoice.date}`),
    [invoice.invoiceNumber, invoice.amount, invoice.date]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // Generate clean standalone A4 invoice HTML download and trigger print-ready export
    const itemRowsHtml = invoice.items
      .map(
        (item, idx) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #E6EAF0;">${idx + 1}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E6EAF0;font-weight:600;">${item.name}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E6EAF0;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E6EAF0;text-align:right;">${formatBDT(item.unitPrice)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E6EAF0;text-align:right;font-weight:600;">${formatBDT(item.unitPrice * item.quantity)}</td>
      </tr>`
      )
      .join('');

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Invoice ${invoice.invoiceNumber}</title></head>
<body style="font-family:Inter,Arial,sans-serif;color:#111827;padding:40px;max-width:760px;margin:0 auto;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #E6EAF0;padding-bottom:20px;">
    <div>
      <h1 style="margin:0;font-size:22px;">${settings.storeName}</h1>
      <p style="margin:4px 0;color:#4B5563;font-size:13px;">${settings.address}</p>
      <p style="margin:0;color:#4B5563;font-size:13px;">${settings.phone}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#4F46E5;">INVOICE ${invoice.invoiceNumber}</p>
      <p style="margin:4px 0;color:#4B5563;font-size:13px;">${invoice.date} · ${invoice.time}</p>
      <p style="margin:4px 0;font-weight:700;color:${invoice.paymentStatus === 'Paid' ? '#10B981' : '#F59E0B'};">${invoice.paymentStatus.toUpperCase()}</p>
    </div>
  </div>
  <div style="margin:20px 0;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">BILLED TO</p>
    <p style="margin:4px 0;font-size:15px;font-weight:600;">${invoice.customerName}</p>
    ${customer ? `<p style="margin:0;font-size:13px;color:#4B5563;">${customer.phone} · ${customer.area}</p>` : ''}
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
    <thead>
      <tr style="background:#F6F8FB;text-align:left;">
        <th style="padding:10px 8px;">#</th>
        <th style="padding:10px 8px;">Item</th>
        <th style="padding:10px 8px;text-align:center;">Qty</th>
        <th style="padding:10px 8px;text-align:right;">Price</th>
        <th style="padding:10px 8px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${itemRowsHtml}</tbody>
  </table>
  <div style="margin-top:20px;margin-left:auto;width:260px;font-size:13px;">
    <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Subtotal</span><span>${formatBDT(invoice.subtotal)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Discount</span><span>-${formatBDT(invoice.discount)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>VAT</span><span>${formatBDT(invoice.vat)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #E6EAF0;font-size:16px;font-weight:700;"><span>Grand Total</span><span>${formatBDT(invoice.amount)}</span></div>
  </div>
  <p style="margin-top:36px;font-size:12px;color:#9CA3AF;text-align:center;">${settings.receiptFooter}</p>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PayNest-${invoice.invoiceNumber.replace('#', '')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded invoice ${invoice.invoiceNumber}`);
  };

  const openShareModal = (channel: 'whatsapp' | 'email') => {
    if (channel === 'whatsapp') {
      setRecipientInput(customer?.phone || '000-000-0000');
    } else {
      setRecipientInput(
        `${invoice.customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`
      );
    }
    setShareModal(channel);
  };

  const handleSendShare = (e: React.FormEvent) => {
    e.preventDefault();
    const channelLabel = shareModal === 'whatsapp' ? 'WhatsApp' : 'Email';
    setShareModal(null);
    showToast(`Invoice ${invoice.invoiceNumber} sent via ${channelLabel} to ${recipientInput}`);
  };

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Invoice Selector Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#4B5563] flex items-center justify-center transition-colors"
            aria-label="Back to Sales History"
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[12.5px] text-[#9CA3AF]">
              <button
                type="button"
                onClick={onBack}
                className="hover:text-[#4F46E5] transition-colors"
              >
                Sales History
              </button>
              <span aria-hidden="true">/</span>
              <span className="text-[#4B5563] font-medium">{invoice.invoiceNumber}</span>
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827] mt-0.5">
              Invoice Preview
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {toast && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[12.5px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              {toast}
            </span>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="invoice-switcher" className="text-[12.5px] font-medium text-[#4B5563]">
              Switch Invoice
            </label>
            <select
              id="invoice-switcher"
              value={invoice.id}
              onChange={(e) => {
                const found = allInvoices.find((i) => i.id === e.target.value);
                if (found) onSelectInvoice(found);
              }}
              className="h-10 px-3 text-[13.5px] bg-white border border-[#E6EAF0] rounded-[10px] text-[#111827] tabular-nums focus:outline-none focus:border-[#4F46E5]"
            >
              {allInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} · {inv.customerName} ({formatBDT(inv.amount)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout: Center A4 Invoice Card + Right Side Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-6 items-start max-w-[1160px] mx-auto">
        {/* CENTER: A4 Invoice Card */}
        <div className="print-invoice-card pos-card p-8 sm:p-10 bg-white w-full max-w-[780px] mx-auto relative">
          {/* Shop Logo, Name, Address + Invoice Metadata */}
          <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-[#E6EAF0]">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[10px] bg-[#4F46E5] flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-6 h-6 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M7 10h4" />
                  <path d="M7 14h2" />
                  <path d="M15 10h2v4h-2z" />
                  <path d="M6 21h12" />
                </svg>
              </div>
              <div>
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[#111827]">
                  {settings.storeName}
                </h2>
                <p className="text-[13px] font-medium text-[#4B5563] mt-0.5">
                  {settings.branchName}
                </p>
                <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">{settings.address}</p>
                <p className="text-[12.5px] text-[#9CA3AF] tabular-nums">{settings.phone}</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-[12px] font-semibold tracking-wider text-[#9CA3AF]">TAX INVOICE</p>
              <p className="text-[20px] font-bold text-[#4F46E5] tabular-nums mt-0.5">
                {invoice.invoiceNumber}
              </p>
              <p className="text-[13px] text-[#4B5563] mt-1 tabular-nums">
                Date: <span className="font-medium text-[#111827]">{invoice.date}</span>
              </p>
              <p className="text-[12.5px] text-[#9CA3AF] tabular-nums">Time: {invoice.time}</p>
            </div>
          </div>

          {/* Customer Info + "Paid" Stamp */}
          <div className="py-6 flex flex-wrap items-center justify-between gap-6 border-b border-[#E6EAF0]">
            <div>
              <p className="text-[12px] font-semibold text-[#9CA3AF]">Billed To</p>
              <p className="text-[16px] font-semibold text-[#111827] mt-1">
                {invoice.customerName}
              </p>
              {customer ? (
                <div className="text-[13px] text-[#4B5563] mt-0.5 space-y-0.5">
                  <p className="tabular-nums">{customer.phone}</p>
                  <p className="text-[#9CA3AF]">{customer.area}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF] mt-0.5">Counter Walk-in Customer</p>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right text-[13px]">
                <p className="text-[#9CA3AF] text-[12px]">Payment Method</p>
                <p className="font-semibold text-[#111827] mt-0.5">{invoice.paymentMethod}</p>
                <p className="text-[#9CA3AF] text-[12px] mt-1">Cashier: Sanzid</p>
              </div>

              {/* Authentic Stamp Badge ("PAID" / "DUE") */}
              <div
                className={`px-4 py-1.5 rounded-[8px] border-2 font-bold text-[15px] tracking-[0.14em] uppercase -rotate-6 select-none ${
                  invoice.paymentStatus === 'Paid'
                    ? 'border-[#10B981] text-[#10B981] bg-[#ECFDF5]/70'
                    : 'border-[#F59E0B] text-[#D97706] bg-[#FFFBEB]/80'
                }`}
              >
                {invoice.paymentStatus}
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                  <th className="py-3 pl-3 pr-2 w-10">#</th>
                  <th className="py-3 px-2">Item Description</th>
                  <th className="py-3 px-2 text-center w-20">Qty</th>
                  <th className="py-3 px-2 text-right w-28">Unit Price</th>
                  <th className="py-3 pl-2 pr-3 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
                {invoice.items.map((item, idx) => (
                  <tr key={`${item.productId}-${idx}`}>
                    <td className="py-3.5 pl-3 pr-2 text-[#9CA3AF] tabular-nums">{idx + 1}</td>
                    <td className="py-3.5 px-2 font-medium text-[#111827]">{item.name}</td>
                    <td className="py-3.5 px-2 text-center text-[#4B5563] tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-2 text-right text-[#4B5563] tabular-nums">
                      {formatBDT(item.unitPrice)}
                    </td>
                    <td className="py-3.5 pl-2 pr-3 text-right font-semibold text-[#111827] tabular-nums">
                      {formatBDT(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="pt-4 border-t border-[#E6EAF0] flex justify-end">
            <div className="w-full max-w-[290px] space-y-2 text-[13.5px]">
              <div className="flex justify-between text-[#4B5563]">
                <span>Subtotal</span>
                <span className="font-medium text-[#111827] tabular-nums">
                  {formatBDT(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>Discount</span>
                <span className="font-medium text-[#10B981] tabular-nums">
                  -{formatBDT(invoice.discount)}
                </span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>VAT ({settings.vatPercent}%)</span>
                <span className="font-medium text-[#111827] tabular-nums">
                  {formatBDT(invoice.vat)}
                </span>
              </div>
              <div className="pt-2.5 border-t border-[#E6EAF0] flex items-center justify-between">
                <span className="text-[15px] font-bold text-[#111827]">Grand Total</span>
                <span className="text-[22px] font-bold text-[#4F46E5] tabular-nums">
                  {formatBDT(invoice.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer: Thank-you Note & QR Code */}
          <div className="mt-8 pt-6 border-t border-dashed border-[#E6EAF0] flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-[460px] space-y-1.5">
              <p className="text-[13.5px] font-semibold text-[#111827]">
                Thank you for your business!
              </p>
              <p className="text-[12.5px] text-[#4B5563] leading-relaxed">
                {settings.receiptFooter}
              </p>
              <p className="text-[11.5px] text-[#9CA3AF] pt-1">
                Authorized by {settings.storeName} · Computer-generated invoice
              </p>
            </div>

            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="p-2 bg-white border border-[#E6EAF0] rounded-[10px]">
                <svg
                  viewBox="0 0 21 21"
                  className="w-[74px] h-[74px] text-[#111827]"
                  shapeRendering="crispEdges"
                  aria-label="Invoice verification QR code"
                >
                  <rect width="21" height="21" fill="#FFFFFF" />
                  {qrMatrix.map((row, r) =>
                    row.map((filled, c) =>
                      filled ? (
                        <rect
                          key={`${r}-${c}`}
                          x={c}
                          y={r}
                          width="1"
                          height="1"
                          fill="currentColor"
                        />
                      ) : null
                    )
                  )}
                </svg>
              </div>
              <span className="text-[11px] text-[#9CA3AF] tabular-nums">
                Verify {invoice.invoiceNumber}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE PANEL: Print, Download PDF, Send via WhatsApp, Send via Email */}
        <div className="no-print space-y-4 lg:sticky lg:top-[92px]">
          <div className="pos-card p-5 space-y-3">
            <h3 className="text-[15px] font-semibold text-[#111827] pb-2 border-b border-[#F1F4F8]">
              Invoice Actions
            </h3>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full h-11 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4 stroke-[2]" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="w-full h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] text-[#111827] text-[13.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-[#4B5563] stroke-[1.75]" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => openShareModal('whatsapp')}
              className="w-full h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#ECFDF5] hover:border-[#10B981]/50 text-[#111827] text-[13.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#10B981] stroke-[1.75]" />
              <span>Send via WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => openShareModal('email')}
              className="w-full h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#EEF2FF] hover:border-[#4F46E5]/40 text-[#111827] text-[13.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Mail className="w-4 h-4 text-[#4F46E5] stroke-[1.75]" />
              <span>Send via Email</span>
            </button>

            {invoice.paymentStatus === 'Due' && (
              <button
                type="button"
                onClick={() => {
                  onMarkPaid(invoice.id);
                  showToast(`${invoice.invoiceNumber} marked as Paid`);
                }}
                className="w-full h-10 px-4 rounded-[10px] bg-[#10B981] hover:bg-[#059669] text-white text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition-colors mt-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark as Paid</span>
              </button>
            )}
          </div>

          {/* Quick Payment Summary */}
          <div className="pos-card p-5 space-y-2.5 text-[13px]">
            <h4 className="text-[13px] font-semibold text-[#111827]">Payment Details</h4>
            <div className="flex justify-between text-[#4B5563]">
              <span>Status</span>
              <span
                className={`font-semibold ${
                  invoice.paymentStatus === 'Paid' ? 'text-[#10B981]' : 'text-[#D97706]'
                }`}
              >
                {invoice.paymentStatus}
              </span>
            </div>
            <div className="flex justify-between text-[#4B5563]">
              <span>Method</span>
              <span className="font-medium text-[#111827]">{invoice.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-[#4B5563]">
              <span>Total Items</span>
              <span className="font-medium text-[#111827] tabular-nums">
                {invoice.items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            <div className="flex justify-between text-[#4B5563] pt-2 border-t border-[#F1F4F8]">
              <span>Net Profit</span>
              <span className="font-semibold text-[#10B981] tabular-nums">
                +{formatBDT(invoice.profit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Share via WhatsApp / Email Modal */}
      {shareModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[420px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">
                {shareModal === 'whatsapp' ? 'Send via WhatsApp' : 'Send via Email'}
              </h3>
              <button
                type="button"
                onClick={() => setShareModal(null)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close share dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendShare} className="p-6 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                  {shareModal === 'whatsapp' ? 'Customer WhatsApp Number' : 'Customer Email Address'}
                </label>
                <input
                  type={shareModal === 'email' ? 'email' : 'text'}
                  required
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>

              <div className="p-3.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] text-[12.5px] text-[#4B5563] space-y-1">
                <p className="font-semibold text-[#111827]">Message Preview</p>
                <p>
                  Hello {invoice.customerName}, thank you for shopping at {settings.storeName}! Your
                  invoice {invoice.invoiceNumber} for{' '}
                  <span className="font-semibold text-[#111827]">{formatBDT(invoice.amount)}</span>{' '}
                  ({invoice.paymentStatus}) is attached.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShareModal(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
