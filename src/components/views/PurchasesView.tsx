import React, { useState } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  X,
  ShoppingBag,
  Clock,
  Truck,
  Eye,
  Trash2,
  Wallet,
  PackageCheck,
} from 'lucide-react';
import { PurchaseOrder, Supplier } from '../../types/pos';
import { calculateDueAmount } from '../../utils/billing';
import { formatBDT } from '../../utils/format';

interface PurchasesViewProps {
  purchases: PurchaseOrder[];
  suppliers: Supplier[];
  onReceiveOrder: (purchaseId: string) => void;
  onAddPurchase: (po: {
    supplierName: string;
    itemsSummary: string;
    itemCount: number;
    totalAmount: number;
    paidAmount: number;
    status: 'Received' | 'Pending';
    date: string;
  }) => void;
  onRecordPayment: (purchaseId: string, payAmount: number) => void;
  onDeletePurchase: (purchaseId: string) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}

type PaymentFilter = 'all' | 'Paid' | 'Partial' | 'Due';

function getPaymentStatus(po: PurchaseOrder): 'Paid' | 'Partial' | 'Due' {
  const due = calculateDueAmount(po.totalAmount, po.paidAmount);
  if (due === 0) return 'Paid';
  if (po.paidAmount > 0) return 'Partial';
  return 'Due';
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  suppliers,
  onReceiveOrder,
  onAddPurchase,
  onRecordPayment,
  onDeletePurchase,
  canWrite = true,
  canDelete = true,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>('all');
  const [toast, setToast] = useState<string | null>(null);

  // New Purchase modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierName, setSupplierName] = useState(suppliers[0]?.company || '');
  const [purchaseDate, setPurchaseDate] = useState('21 Nov 2026');
  const [itemsSummary, setItemsSummary] = useState('');
  const [itemCount, setItemCount] = useState('40');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [deliveryStatus, setDeliveryStatus] = useState<'Received' | 'Pending'>('Pending');

  // Payment, View & Delete modals
  const [payTarget, setPayTarget] = useState<PurchaseOrder | null>(null);
  const [payInput, setPayInput] = useState('');
  const [viewTarget, setViewTarget] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Summary metrics
  const totalPurchasesAmount = purchases.reduce((sum, po) => sum + po.totalAmount, 0);
  const totalPendingPayments = purchases.reduce(
    (sum, po) => sum + calculateDueAmount(po.totalAmount, po.paidAmount),
    0
  );
  const pendingPaymentOrdersCount = purchases.filter(
    (po) => calculateDueAmount(po.totalAmount, po.paidAmount) > 0
  ).length;
  const activeSuppliersCount = suppliers.length;
  const suppliersWithPendingCount = new Set(
    purchases
      .filter((po) => calculateDueAmount(po.totalAmount, po.paidAmount) > 0)
      .map((po) => po.supplierName)
  ).size;

  const filteredPurchases = purchases.filter((po) => {
    const payStatus = getPaymentStatus(po);
    const matchesStatus = statusFilter === 'all' ? true : payStatus === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.itemsSummary.toLowerCase().includes(q) ||
      po.date.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const openCreateModal = () => {
    setSupplierName(suppliers[0]?.company || '');
    setPurchaseDate('21 Nov 2026');
    setItemsSummary('');
    setItemCount('40');
    setTotalAmount('');
    setPaidAmount('0');
    setDeliveryStatus('Pending');
    setCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalNum = Number(totalAmount);
    if (!itemsSummary.trim() || !totalNum || totalNum <= 0) return;
    const paidNum = Math.min(Math.max(Number(paidAmount) || 0, 0), totalNum);

    onAddPurchase({
      supplierName,
      itemsSummary: itemsSummary.trim(),
      itemCount: Math.max(Number(itemCount) || 1, 1),
      totalAmount: totalNum,
      paidAmount: paidNum,
      status: deliveryStatus,
      date: purchaseDate.trim() || '21 Nov 2026',
    });
    showToast(`Created new purchase order for ${supplierName}`);
    setCreateOpen(false);
  };

  const openPayModal = (po: PurchaseOrder) => {
    const due = calculateDueAmount(po.totalAmount, po.paidAmount);
    setPayTarget(po);
    setPayInput(String(due));
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const due = calculateDueAmount(payTarget.totalAmount, payTarget.paidAmount);
    const amount = Math.min(Math.max(Number(payInput) || 0, 0), due);
    if (amount <= 0) return;

    onRecordPayment(payTarget.id, amount);
    showToast(`Recorded ${formatBDT(amount)} payment for ${payTarget.poNumber}`);
    setPayTarget(null);
  };

  const totalDraftNum = Math.max(Number(totalAmount) || 0, 0);
  const paidDraftNum = Math.min(Math.max(Number(paidAmount) || 0, 0), totalDraftNum);
  const dueDraftNum = calculateDueAmount(totalDraftNum, paidDraftNum);

  return (
    <div className="space-y-5">
      {/* Header with "New Purchase" button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Purchases</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Track supplier purchase orders, vendor payments &amp; incoming stock
          </p>
        </div>

        <div className="flex items-center gap-3">
          {toast && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[12.5px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              {toast}
            </span>
          )}
          <button
            type="button"
            disabled={!canWrite}
            onClick={openCreateModal}
            className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            New Purchase
          </button>
        </div>
      </div>

      {/* Top Stat Cards: Total Purchases, Pending Payments, Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="pos-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Total Purchases</p>
            <p className="text-[24px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1">
              {formatBDT(totalPurchasesAmount)}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1 tabular-nums">
              {purchases.length} purchase orders
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <div className="pos-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Pending Payments</p>
            <p
              className={`text-[24px] font-bold tracking-[-0.02em] tabular-nums mt-1 ${
                totalPendingPayments > 0 ? 'text-[#D97706]' : 'text-[#10B981]'
              }`}
            >
              {formatBDT(totalPendingPayments)}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1 tabular-nums">
              {pendingPaymentOrdersCount > 0
                ? `${pendingPaymentOrdersCount} orders with due balance`
                : 'All supplier invoices paid'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <div className="pos-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Suppliers</p>
            <p className="text-[24px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1">
              {activeSuppliersCount}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1 tabular-nums">
              {suppliersWithPendingCount > 0
                ? `${suppliersWithPendingCount} with active payable`
                : 'No pending vendor dues'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="pos-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[380px]">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Purchase #, supplier, or items..."
            className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px]">
          {[
            { id: 'all' as const, label: `All (${purchases.length})` },
            {
              id: 'Paid' as const,
              label: `Paid (${purchases.filter((p) => getPaymentStatus(p) === 'Paid').length})`,
            },
            {
              id: 'Partial' as const,
              label: `Partial (${purchases.filter((p) => getPaymentStatus(p) === 'Partial').length})`,
            },
            {
              id: 'Due' as const,
              label: `Due (${purchases.filter((p) => getPaymentStatus(p) === 'Due').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-3">Purchase #</th>
                <th className="py-3.5 px-3">Supplier</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3 text-right">Total</th>
                <th className="py-3.5 px-3 text-right">Paid</th>
                <th className="py-3.5 px-3 text-right">Due</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#9CA3AF]">
                    No purchase orders match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => {
                  const dueAmount = calculateDueAmount(po.totalAmount, po.paidAmount);
                  const payStatus = getPaymentStatus(po);

                  const statusBadgeStyle =
                    payStatus === 'Paid'
                      ? 'bg-[#ECFDF5] text-[#059669]'
                      : payStatus === 'Partial'
                        ? 'bg-[#FFFBEB] text-[#D97706]'
                        : 'bg-[#FEF2F2] text-[#EF4444]';

                  return (
                    <tr key={po.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 pl-6 pr-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewTarget(po)}
                          className="font-semibold text-[#4F46E5] hover:underline tabular-nums"
                        >
                          #{po.poNumber}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 min-w-[240px]">
                        <p className="font-semibold text-[#111827]">{po.supplierName}</p>
                        <p className="text-[12px] text-[#9CA3AF] truncate max-w-[320px]">
                          {po.itemsSummary} · {po.itemCount} units
                        </p>
                      </td>

                      <td className="py-3.5 px-3 text-[#4B5563] tabular-nums whitespace-nowrap">
                        {po.date}
                      </td>

                      <td className="py-3.5 px-3 text-right font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                        {formatBDT(po.totalAmount)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-[#059669] tabular-nums whitespace-nowrap">
                        {formatBDT(po.paidAmount)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                        {dueAmount > 0 ? (
                          <span className="text-[#EF4444]">{formatBDT(dueAmount)}</span>
                        ) : (
                          <span className="text-[#10B981] font-medium">৳0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${statusBadgeStyle}`}
                        >
                          {payStatus}
                        </span>
                      </td>

                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {dueAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => openPayModal(po)}
                              className="px-2.5 py-1.5 rounded-[8px] bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-[12px] font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Record supplier payment"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Pay
                            </button>
                          )}
                          {po.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => {
                                onReceiveOrder(po.id);
                                showToast(`Marked ${po.poNumber} stock as received`);
                              }}
                              className="p-2 rounded-[8px] text-[#059669] hover:bg-[#ECFDF5] transition-colors"
                              aria-label={`Mark ${po.poNumber} received`}
                              title="Mark stock received"
                            >
                              <PackageCheck className="w-4 h-4 stroke-[1.75]" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewTarget(po)}
                            className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
                            aria-label={`View ${po.poNumber}`}
                            title="View purchase details"
                          >
                            <Eye className="w-4 h-4 stroke-[1.75]" />
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => setDeleteTarget(po)}
                            className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                            aria-label={`Delete ${po.poNumber}`}
                            title="Delete purchase"
                          >
                            <Trash2 className="w-4 h-4 stroke-[1.75]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">New Purchase</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close new purchase modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Supplier
                  </label>
                  <select
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] bg-white focus:outline-none focus:border-[#4F46E5]"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.company}>
                        {s.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="text"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    placeholder="21 Nov 2026"
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Items Summary <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemsSummary}
                  onChange={(e) => setItemsSummary(e.target.value)}
                  placeholder="e.g., Rupchanda Soyabin Oil 5L (30 bottles)"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Total Units
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={itemCount}
                    onChange={(e) => setItemCount(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Total (৳) <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="23550"
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Paid Now (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalDraftNum || undefined}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
              </div>

              {totalDraftNum > 0 && (
                <div className="p-3 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] flex items-center justify-between text-[13px]">
                  <span className="text-[#4B5563]">Remaining Due</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPaidAmount(String(totalDraftNum))}
                      className="text-[12px] font-semibold text-[#4F46E5] hover:underline"
                    >
                      Mark Full Paid
                    </button>
                    <span
                      className={`font-bold tabular-nums ${
                        dueDraftNum > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
                      }`}
                    >
                      {formatBDT(dueDraftNum)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                  Stock Delivery Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Pending', 'Received'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDeliveryStatus(st)}
                      className={`h-9 rounded-[9px] text-[13px] font-medium border transition-colors ${
                        deliveryStatus === st
                          ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]'
                          : 'bg-white border-[#E6EAF0] text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      {st === 'Received' ? 'Stock Received' : 'Delivery Pending'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold"
                >
                  Save Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Supplier Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[420px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">
                Record Payment · #{payTarget.poNumber}
              </h3>
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] space-y-1.5 text-[13px]">
                <p className="font-semibold text-[#111827]">{payTarget.supplierName}</p>
                <div className="flex justify-between text-[#4B5563] tabular-nums">
                  <span>Invoice Total: {formatBDT(payTarget.totalAmount)}</span>
                  <span>
                    Due:{' '}
                    <span className="font-bold text-[#EF4444]">
                      {formatBDT(calculateDueAmount(payTarget.totalAmount, payTarget.paidAmount))}
                    </span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                  Payment Amount (৳)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={calculateDueAmount(payTarget.totalAmount, payTarget.paidAmount)}
                  value={payInput}
                  onChange={(e) => setPayInput(e.target.value)}
                  className="w-full h-10 px-3 text-[14px] font-semibold tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
                <div className="flex items-center gap-2 mt-2">
                  {[
                    {
                      label: 'Full Due',
                      val: calculateDueAmount(payTarget.totalAmount, payTarget.paidAmount),
                    },
                    {
                      label: '50%',
                      val: Math.round(
                        calculateDueAmount(payTarget.totalAmount, payTarget.paidAmount) / 2
                      ),
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setPayInput(String(preset.val))}
                      className="px-3 py-1 rounded-[8px] text-[12px] font-semibold bg-[#F6F8FB] border border-[#E6EAF0] text-[#4B5563] hover:text-[#4F46E5] hover:border-[#4F46E5] tabular-nums"
                    >
                      {preset.label} ({formatBDT(preset.val)})
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Order Detail Modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[460px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#111827] tabular-nums">
                  Purchase #{viewTarget.poNumber}
                </h3>
                <p className="text-[12px] text-[#9CA3AF] tabular-nums">{viewTarget.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-[13.5px]">
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-[#9CA3AF]">Supplier</p>
                <p className="font-semibold text-[#111827]">{viewTarget.supplierName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-[#9CA3AF]">Items &amp; Quantity</p>
                <p className="text-[#4B5563]">
                  {viewTarget.itemsSummary} ({viewTarget.itemCount} units)
                </p>
              </div>
              <div className="p-4 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] space-y-2 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Total Amount</span>
                  <span className="font-semibold text-[#111827]">
                    {formatBDT(viewTarget.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Paid Amount</span>
                  <span className="font-semibold text-[#059669]">
                    {formatBDT(viewTarget.paidAmount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E6EAF0] flex justify-between">
                  <span className="font-medium text-[#111827]">Due Balance</span>
                  <span
                    className={`font-bold ${
                      calculateDueAmount(viewTarget.totalAmount, viewTarget.paidAmount) > 0
                        ? 'text-[#EF4444]'
                        : 'text-[#10B981]'
                    }`}
                  >
                    {formatBDT(calculateDueAmount(viewTarget.totalAmount, viewTarget.paidAmount))}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#4B5563]">Delivery Status</span>
                <span
                  className={`px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${
                    viewTarget.status === 'Received'
                      ? 'bg-[#ECFDF5] text-[#059669]'
                      : 'bg-[#FFFBEB] text-[#D97706]'
                  }`}
                >
                  {viewTarget.status}
                </span>
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                {viewTarget.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      onReceiveOrder(viewTarget.id);
                      setViewTarget({ ...viewTarget, status: 'Received' });
                      showToast(`Marked ${viewTarget.poNumber} stock as received`);
                    }}
                    className="px-4 py-2 rounded-[10px] bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] text-[13.5px] font-semibold"
                  >
                    Mark Received
                  </button>
                )}
                {calculateDueAmount(viewTarget.totalAmount, viewTarget.paidAmount) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewTarget;
                      setViewTarget(null);
                      openPayModal(target);
                    }}
                    className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold"
                  >
                    Pay Due
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewTarget(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[400px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold text-[#111827]">Delete Purchase Order</h3>
            <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
              Remove <span className="font-semibold text-[#111827]">#{deleteTarget.poNumber}</span>{' '}
              ({deleteTarget.supplierName}) from your purchase history?
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canDelete}
                onClick={() => {
                  onDeletePurchase(deleteTarget.id);
                  showToast(`Removed #${deleteTarget.poNumber}`);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-[10px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13.5px] font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
