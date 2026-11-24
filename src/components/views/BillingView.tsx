import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, ReceiptText } from 'lucide-react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { BillSummary } from '../common/BillSummary';
import type {
  BillView,
  PaymentMethodKey,
  RestaurantOrder,
  RestaurantTable,
} from '../../types/domain';
import { formatMoney, parseMinorUnits } from '../../utils/money';

interface BillingViewProps {
  canDiscount: boolean;
  canSplit: boolean;
  canPay: boolean;
  canVoid: boolean;
  initialOrderId?: string;
}

const METHODS: PaymentMethodKey[] = ['Cash', 'bKash', 'Nagad', 'Card'];

export function BillingView({
  canDiscount,
  canSplit,
  canPay,
  canVoid,
  initialOrderId,
}: BillingViewProps) {
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedId, setSelectedId] = useState(initialOrderId ?? '');
  const [bill, setBill] = useState<BillView | null>(null);
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [splitParts, setSplitParts] = useState('2');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [splitId, setSplitId] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    const [orderRows, tableRows] = await Promise.all([api.getOrders(), api.getTables()]);
    const billable = orderRows.filter(
      (order) =>
        order.paymentStatus === 'unpaid' &&
        order.status !== 'closed' &&
        order.status !== 'pending_confirmation'
    );
    setOrders(billable);
    setTables(tableRows);
    setSelectedId((current) => current || billable[0]?.id || '');
    return billable;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const billable = await loadOrders();
      const selected = billable.find((order) => order.id === selectedId) ?? billable[0];
      setBill(selected?.billNumber ? await api.getBill(selected.id) : null);
    } catch {
      setError('Unable to load bills.');
    } finally {
      setLoading(false);
    }
  }, [loadOrders, selectedId]);

  useEffect(() => {
    void load();
    // The selected id is intentionally excluded: changing it has its own handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId]
  );
  const tableNumber = tables.find((table) => table.id === selectedOrder?.tableId)?.number;

  async function selectOrder(id: string) {
    setSelectedId(id);
    setBill(null);
    setSplitId('');
    setError('');
    try {
      const order = orders.find((entry) => entry.id === id);
      setBill(order?.billNumber ? await api.getBill(id) : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load that bill.');
    }
  }

  // A selection made in another screen (search, tables, notifications) carries over.
  useEffect(() => {
    if (initialOrderId && initialOrderId !== selectedId) {
      void selectOrder(initialOrderId);
    }
    // The id itself is the trigger; selectOrder reads the latest orders at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  async function refreshBill() {
    const rows = await loadOrders();
    const current = rows.find((order) => order.id === selectedId);
    setBill(current?.billNumber ? await api.getBill(selectedId) : null);
  }

  async function requestBill() {
    if (!selectedOrder || busy) return;
    setBusy(true);
    setError('');
    try {
      setBill(await api.requestBill(selectedOrder.id));
      await loadOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request the bill.');
    } finally {
      setBusy(false);
    }
  }

  async function applyDiscount() {
    if (!selectedOrder || busy) return;
    const value = discountType === 'percent' ? Number(discountValue) : parseMinorUnits(discountValue);
    if (discountType !== 'none' && (value === null || !Number.isFinite(value) || value < 0)) {
      setError('Enter a valid discount amount.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setBill(await api.setDiscount(selectedOrder.id, { type: discountType, value: value ?? 0 }));
      setDiscountValue('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to apply the discount.');
    } finally {
      setBusy(false);
    }
  }

  async function createSplits(mode: 'equal' | 'items') {
    if (!selectedOrder || busy) return;
    const parts = Number(splitParts);
    if (mode === 'equal' && (!Number.isInteger(parts) || parts < 2 || parts > 100)) {
      setError('Choose between 2 and 100 equal parts.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setBill(
        await api.createSplits(
          selectedOrder.id,
          mode === 'equal' ? { mode: 'equal', parts } : { mode: 'items' }
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to split the bill.');
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    if (!selectedOrder || !bill || busy) return;
    const amount = parseMinorUnits(paymentAmount);
    if (amount === null || amount <= 0) {
      setError('Enter a valid payment amount in taka.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setBill(
        await api.recordPayment(selectedOrder.id, {
          method: paymentMethod,
          amount,
          reference: reference.trim(),
          ...(splitId ? { splitId } : {}),
        })
      );
      setPaymentAmount('');
      setReference('');
      await loadOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record the payment.');
    } finally {
      setBusy(false);
    }
  }

  async function voidBill() {
    if (!selectedOrder || busy) return;
    setBusy(true);
    try {
      setBill(await api.voidBill(selectedOrder.id));
      await loadOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to void the bill.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading bills…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Billing</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Totals, VAT and service charge are calculated by the server.
          </p>
        </div>
        {bill && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[9px] border border-[#E6EAF0] bg-white px-4 py-2 text-[13px] font-semibold text-[#4B5563] hover:bg-[#F6F8FB]"
          >
            <Printer className="h-4 w-4" /> Print invoice
          </button>
        )}
      </div>

      {error && <ErrorState message={error} />}

      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#E6EAF0] bg-white p-4">
        <label htmlFor="bill-order" className="text-[13px] font-semibold text-[#374151]">
          Order
        </label>
        <select
          id="bill-order"
          value={selectedId}
          onChange={(event) => void selectOrder(event.target.value)}
          className="h-10 min-w-[300px] rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
        >
          <option value="">Select an order</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.orderNumber} — Table {tables.find((table) => table.id === order.tableId)?.number ?? '—'}
            </option>
          ))}
        </select>
        {selectedOrder && !selectedOrder.billNumber && (
          <button
            type="button"
            onClick={() => void requestBill()}
            disabled={busy}
            className="rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
          >
            Request bill
          </button>
        )}
      </div>

      {!selectedOrder ? (
        <EmptyState title="Select an order" description="Choose an open order to build its bill." />
      ) : !bill ? (
        <EmptyState
          title="Bill not requested yet"
          description="Request the bill to calculate totals on the server."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <BillSummary bill={bill} tableNumber={tableNumber} />

          <aside className="space-y-4">
            {canDiscount && (
              <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4">
                <h2 className="text-[13px] font-semibold text-[#111827]">Discount</h2>
                <div className="mt-3 flex gap-2">
                  <select
                    value={discountType}
                    onChange={(event) => {
                      setDiscountType(event.target.value as 'none' | 'fixed' | 'percent');
                      setDiscountValue('');
                    }}
                    className="h-10 rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-2 text-[12px]"
                  >
                    <option value="none">None</option>
                    <option value="fixed">Fixed taka</option>
                    <option value="percent">Percent</option>
                  </select>
                  {discountType !== 'none' && (
                    <input
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      placeholder={discountType === 'percent' ? '10' : '50.00'}
                      inputMode="decimal"
                      className="h-10 min-w-0 flex-1 rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void applyDiscount()}
                    disabled={busy}
                    className="rounded-[9px] bg-[#EEF2FF] px-3 text-[12px] font-semibold text-[#4338CA] disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-[#9CA3AF]">
                  The server clamps discounts to the bill total and your role limit.
                </p>
              </section>
            )}

            <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                <ReceiptText className="h-4 w-4 text-[#4F46E5]" /> Split bill
              </h2>
              {canSplit ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={splitParts}
                      onChange={(event) => setSplitParts(event.target.value)}
                      inputMode="numeric"
                      aria-label="Number of equal splits"
                      className="h-9 w-20 rounded-[9px] border border-[#E6EAF0] px-2 text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => void createSplits('equal')}
                      disabled={busy}
                      className="rounded-[9px] border border-[#E6EAF0] px-3 text-[12px] font-semibold text-[#4B5563]"
                    >
                      Split equally
                    </button>
                    <button
                      type="button"
                      onClick={() => void createSplits('items')}
                      disabled={busy}
                      className="rounded-[9px] border border-[#E6EAF0] px-3 text-[12px] font-semibold text-[#4B5563]"
                    >
                      By item
                    </button>
                  </div>
                  {bill.splits.length > 0 && (
                    <ul className="mt-3 divide-y divide-[#F1F4F8] text-[12px]">
                      {bill.splits.map((split) => (
                        <li key={split.id} className="flex justify-between py-1.5">
                          <span className="text-[#4B5563]">{split.label}</span>
                          <span className="tabular-nums text-[#111827]">
                            {formatMoney(split.amount, bill.settings.currencySymbol)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-2 text-[12px] text-[#9CA3AF]">Splitting is not available to your role.</p>
              )}
            </section>

            <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4">
              <h2 className="text-[13px] font-semibold text-[#111827]">Payment</h2>
              {canPay ? (
                <>
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodKey)}
                    className="mt-3 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                  >
                    {METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  <input
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder={`Amount in taka (due ${formatMoney(bill.due, bill.settings.currencySymbol)})`}
                    inputMode="decimal"
                    className="mt-2 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                  />
                  {bill.splits.length > 0 && (
                    <select
                      value={splitId}
                      onChange={(event) => setSplitId(event.target.value)}
                      className="mt-2 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                    >
                      <option value="">Whole bill</option>
                      {bill.splits
                        .filter((split) => !split.paidAt)
                        .map((split) => (
                          <option key={split.id} value={split.id}>
                            {split.label} —{' '}
                            {formatMoney(split.amount, bill.settings.currencySymbol)}
                          </option>
                        ))}
                    </select>
                  )}
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Reference (optional)"
                    className="mt-2 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() => void recordPayment()}
                    disabled={busy || bill.due === 0}
                    className="mt-3 w-full rounded-[9px] bg-[#4F46E5] px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
                  >
                    {bill.due === 0 ? 'Bill settled' : 'Record payment'}
                  </button>
                </>
              ) : (
                <p className="mt-2 text-[12px] text-[#9CA3AF]">Payments are not available to your role.</p>
              )}
              {canVoid && bill.order.paymentStatus === 'unpaid' && (
                <button
                  type="button"
                  onClick={() => void voidBill()}
                  disabled={busy}
                  className="mt-3 w-full rounded-[9px] border border-[#FECACA] px-3 py-2 text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
                >
                  Void bill
                </button>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
