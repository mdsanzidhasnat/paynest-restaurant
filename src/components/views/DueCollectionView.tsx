import React, { useMemo, useState } from 'react';
import {
  Search,
  Banknote,
  Smartphone,
  Wallet,
  CheckCircle2,
  UserCheck,
  ReceiptText,
  Clock,
} from 'lucide-react';
import { Customer, DuePaymentMethod, DuePaymentRecord } from '../../types/pos';
import { calculateDueAmount } from '../../utils/billing';
import { formatBDT } from '../../utils/format';

interface DueCollectionViewProps {
  customers: Customer[];
  paymentHistory: DuePaymentRecord[];
  onCollectPayment: (payload: {
    customerId: string;
    amount: number;
    method: DuePaymentMethod;
    note: string;
  }) => void;
}

const AVATAR_TONES = [
  'bg-[#EEF2FF] text-[#4F46E5]',
  'bg-[#ECFDF5] text-[#059669]',
  'bg-[#FFFBEB] text-[#D97706]',
  'bg-[#F0F9FF] text-[#0284C7]',
  'bg-[#F5F3FF] text-[#7C3AED]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const DueCollectionView: React.FC<DueCollectionViewProps> = ({
  customers,
  paymentHistory,
  onCollectPayment,
}) => {
  const [search, setSearch] = useState('');
  const [showOnlyDue, setShowOnlyDue] = useState(true);

  const customersWithDue = useMemo(
    () => customers.filter((c) => c.dueBalance > 0),
    [customers]
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    () => customersWithDue[0]?.id || customers[0]?.id || ''
  );
  const [amountInput, setAmountInput] = useState<string>(() =>
    customersWithDue[0] ? String(customersWithDue[0].dueBalance) : ''
  );
  const [method, setMethod] = useState<DuePaymentMethod>('Cash');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || customersWithDue[0] || customers[0],
    [customers, customersWithDue, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (showOnlyDue && c.dueBalance <= 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q)
      );
    });
  }, [customers, search, showOnlyDue]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return paymentHistory;
    return paymentHistory.filter(
      (rec) =>
        rec.receiptNumber.toLowerCase().includes(q) ||
        rec.customerName.toLowerCase().includes(q) ||
        rec.method.toLowerCase().includes(q) ||
        rec.note.toLowerCase().includes(q)
    );
  }, [paymentHistory, historySearch]);

  const totalDueOutstanding = customers.reduce((sum, c) => sum + c.dueBalance, 0);
  const totalCollectedHistory = paymentHistory.reduce((sum, r) => sum + r.amount, 0);

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setAmountInput(cust.dueBalance > 0 ? String(cust.dueBalance) : '');
    setNote('');
  };

  const handleCollectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || selectedCustomer.dueBalance <= 0) return;
    const numericAmount = Math.min(
      Math.max(Number(amountInput) || 0, 0),
      selectedCustomer.dueBalance
    );
    if (numericAmount <= 0) return;

    onCollectPayment({
      customerId: selectedCustomer.id,
      amount: numericAmount,
      method,
      note: note.trim() || `Due collected via ${method}`,
    });

    const remainingAfter = calculateDueAmount(selectedCustomer.dueBalance, numericAmount);
    setToast(
      `Collected ${formatBDT(numericAmount)} from ${selectedCustomer.name} (${method})`
    );
    setTimeout(() => setToast(null), 3500);

    setAmountInput(remainingAfter > 0 ? String(remainingAfter) : '');
    setNote('');
  };

  const currentDue = selectedCustomer?.dueBalance ?? 0;
  const parsedAmount = Math.min(Math.max(Number(amountInput) || 0, 0), currentDue);
  const remainingAfter = calculateDueAmount(currentDue, parsedAmount);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">
            Due Collection
          </h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Receive pending customer payments via Cash, bKash, or Nagad and track receipts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {toast && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[13px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              {toast}
            </span>
          )}
          <div className="flex items-center gap-4 px-4 py-2 rounded-[10px] bg-white border border-[#E6EAF0] text-[13px] tabular-nums">
            <div>
              <span className="text-[#9CA3AF]">Total Due: </span>
              <span className="font-bold text-[#EF4444]">{formatBDT(totalDueOutstanding)}</span>
            </div>
            <span className="h-4 w-px bg-[#E6EAF0]" />
            <div>
              <span className="text-[#9CA3AF]">Collected: </span>
              <span className="font-bold text-[#10B981]">{formatBDT(totalCollectedHistory)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Left Customer Due List (60%) + Right Payment Panel (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Customer Search & List of Customers with Due Amount */}
        <div className="lg:col-span-7 pos-card overflow-hidden">
          <div className="p-5 border-b border-[#E6EAF0] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[#111827]">
                  Customers with Due Balance
                </h2>
                <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 tabular-nums">
                  {customersWithDue.length} customers owe a total of {formatBDT(totalDueOutstanding)}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px]">
                <button
                  type="button"
                  onClick={() => setShowOnlyDue(true)}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap ${
                    showOnlyDue
                      ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  Due Only ({customersWithDue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnlyDue(false)}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap ${
                    !showOnlyDue
                      ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  All ({customers.length})
                </button>
              </div>
            </div>

            {/* Customer Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer by name, phone number, or area..."
                className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="divide-y divide-[#F1F4F8] max-h-[420px] overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <div className="py-12 px-6 text-center text-[#9CA3AF] text-[13.5px]">
                No customers match your search or filter.
              </div>
            ) : (
              filteredCustomers.map((cust, index) => {
                const isSelected = selectedCustomer?.id === cust.id;
                const hasDue = cust.dueBalance > 0;
                const tone = AVATAR_TONES[index % AVATAR_TONES.length];

                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className={`w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#EEF2FF]/70'
                        : 'bg-white hover:bg-[#F6F8FB]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full font-semibold text-[13px] flex items-center justify-center border shrink-0 ${
                          isSelected
                            ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                            : `border-[#E6EAF0] ${tone}`
                        }`}
                      >
                        {getInitials(cust.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-[#111827] truncate">
                            {cust.name}
                          </p>
                          {isSelected && (
                            <span className="text-[11px] font-semibold text-[#4F46E5]">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] text-[#4B5563] tabular-nums truncate mt-0.5">
                          {cust.phone} · {cust.area}
                        </p>
                        <p className="text-[11.5px] text-[#9CA3AF] tabular-nums mt-0.5">
                          Total purchase {formatBDT(cust.totalSpent)} · Last order {cust.lastOrderDate}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <p className="text-[11.5px] text-[#9CA3AF]">Due Amount</p>
                      <p
                        className={`text-[15px] font-bold mt-0.5 ${
                          hasDue ? 'text-[#EF4444]' : 'text-[#10B981]'
                        }`}
                      >
                        {formatBDT(cust.dueBalance)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Receive Payment Panel */}
        <div className="lg:col-span-5 pos-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-[18px] h-[18px] text-[#4F46E5]" />
              <h2 className="text-[16px] font-semibold text-[#111827]">Receive Payment</h2>
            </div>
            {selectedCustomer && (
              <span className="text-[12px] text-[#9CA3AF] tabular-nums">
                {selectedCustomer.totalOrders} orders
              </span>
            )}
          </div>

          {selectedCustomer ? (
            <form onSubmit={handleCollectSubmit} className="p-6 space-y-5">
              {/* Selected Customer Box */}
              <div className="p-4 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-semibold text-[13px] flex items-center justify-center border border-[#E6EAF0] shrink-0">
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#111827] truncate">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-[12px] text-[#4B5563] tabular-nums truncate">
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <p className="text-[11.5px] text-[#9CA3AF]">Current Due</p>
                  <p
                    className={`text-[18px] font-bold ${
                      currentDue > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
                    }`}
                  >
                    {formatBDT(currentDue)}
                  </p>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="due-amount"
                    className="block text-[12.5px] font-medium text-[#4B5563]"
                  >
                    Payment Amount (৳)
                  </label>
                  {currentDue > 0 && (
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: 'Full', value: currentDue },
                        { label: '50%', value: Math.round(currentDue / 2) },
                        ...(currentDue >= 500 ? [{ label: '৳500', value: 500 }] : []),
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setAmountInput(String(preset.value))}
                          className="px-2 py-0.5 rounded-[6px] text-[11.5px] font-semibold bg-[#F6F8FB] border border-[#E6EAF0] text-[#4B5563] hover:text-[#4F46E5] hover:border-[#4F46E5] tabular-nums transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#9CA3AF]">
                    ৳
                  </span>
                  <input
                    id="due-amount"
                    type="number"
                    min="1"
                    max={currentDue > 0 ? currentDue : undefined}
                    disabled={currentDue <= 0}
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder={currentDue > 0 ? 'Enter amount' : 'No due balance'}
                    className="w-full h-11 pl-8 pr-4 text-[16px] font-bold tabular-nums bg-white border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 disabled:bg-[#F6F8FB] disabled:text-[#9CA3AF]"
                  />
                </div>
              </div>

              {/* Payment Method Buttons: Cash / bKash / Nagad */}
              <div>
                <p className="text-[12.5px] font-medium text-[#4B5563] mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'Cash' as const, label: 'Cash', icon: Banknote },
                      { id: 'bKash' as const, label: 'bKash', icon: Smartphone },
                      { id: 'Nagad' as const, label: 'Nagad', icon: Wallet },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = method === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMethod(item.id)}
                        className={`h-11 rounded-[10px] border text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                          active
                            ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]'
                            : 'bg-white border-[#E6EAF0] text-[#4B5563] hover:bg-[#F6F8FB] hover:text-[#111827]'
                        }`}
                      >
                        <Icon className="w-4 h-4 stroke-[1.75]" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note Field */}
              <div>
                <label
                  htmlFor="due-note"
                  className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5"
                >
                  Note / Reference
                </label>
                <textarea
                  id="due-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional: e.g., bKash TrxID or receipt note..."
                  className="w-full p-3 text-[13.5px] bg-white border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>

              {/* Remaining Balance Summary */}
              {currentDue > 0 && (
                <div className="p-3.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] flex items-center justify-between text-[13px] tabular-nums">
                  <span className="text-[#4B5563]">Remaining Due After Payment</span>
                  <span
                    className={`font-bold ${
                      remainingAfter === 0 ? 'text-[#10B981]' : 'text-[#111827]'
                    }`}
                  >
                    {formatBDT(remainingAfter)}
                  </span>
                </div>
              )}

              {/* Collect Payment Primary Indigo Button */}
              <button
                type="submit"
                disabled={currentDue <= 0 || parsedAmount <= 0}
                className="w-full h-11 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-[#E6EAF0] disabled:text-[#9CA3AF] text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <UserCheck className="w-4 h-4 stroke-[2]" />
                Collect Payment
              </button>
            </form>
          ) : (
            <div className="p-10 text-center text-[#9CA3AF] text-[13.5px]">
              Select a customer from the list to collect due payment.
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Payment History Table */}
      <div className="pos-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6EAF0] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ReceiptText className="w-[18px] h-[18px] text-[#4F46E5]" />
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">Payment History</h2>
              <p className="text-[12.5px] text-[#9CA3AF] tabular-nums">
                {paymentHistory.length} recent due collection receipts
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-[280px]">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search receipt #, customer, or method..."
              className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-3">Receipt #</th>
                <th className="py-3.5 px-3">Customer</th>
                <th className="py-3.5 px-3">Date &amp; Time</th>
                <th className="py-3.5 px-3">Method</th>
                <th className="py-3.5 px-3">Note</th>
                <th className="py-3.5 px-3 text-right">Collected</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Remaining Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#9CA3AF]">
                    No payment records match your search.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => {
                  const methodBadgeStyle =
                    rec.method === 'Cash'
                      ? 'bg-[#ECFDF5] text-[#059669]'
                      : rec.method === 'bKash'
                        ? 'bg-[#EEF2FF] text-[#4F46E5]'
                        : 'bg-[#FFFBEB] text-[#D97706]';

                  return (
                    <tr key={rec.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 pl-6 pr-3 font-semibold text-[#4F46E5] tabular-nums whitespace-nowrap">
                        {rec.receiptNumber}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <p className="font-semibold text-[#111827]">{rec.customerName}</p>
                        <p className="text-[12px] text-[#9CA3AF] tabular-nums">
                          {rec.customerPhone}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-[#4B5563] tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          {rec.dateTime}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${methodBadgeStyle}`}
                        >
                          {rec.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-[#4B5563] max-w-[260px] truncate">
                        {rec.note}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-[#10B981] tabular-nums whitespace-nowrap">
                        +{formatBDT(rec.amount)}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right tabular-nums whitespace-nowrap">
                        {rec.remainingDue > 0 ? (
                          <span className="font-semibold text-[#EF4444]">
                            {formatBDT(rec.remainingDue)}
                          </span>
                        ) : (
                          <span className="font-medium text-[#10B981]">Settled (৳0)</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
