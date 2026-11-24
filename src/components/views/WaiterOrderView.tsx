import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { MenuItemCard } from '../common/MenuItemCard';
import { OrderTicket } from '../common/OrderTicket';
import { StatusBadge } from '../common/StatusBadge';
import type {
  MenuCategory,
  MenuItem,
  RestaurantOrder,
  RestaurantTable,
} from '../../types/pos';
import { formatMoney } from '../../utils/money';

interface DraftLine {
  key: string;
  itemId: string;
  variantId: string | null;
  name: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
}

interface WaiterOrderViewProps {
  activeOrder: RestaurantOrder | null;
  onSelectOrder: (order: RestaurantOrder | null) => void;
}

export function WaiterOrderView({ activeOrder, onSelectOrder }: WaiterOrderViewProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [pending, setPending] = useState<RestaurantOrder[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [variantId, setVariantId] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshOrders = useCallback(async () => {
    const [orderRows, tableRows] = await Promise.all([api.getOrders(), api.getTables()]);
    setOrders(orderRows.filter((order) => order.paymentStatus === 'unpaid' && order.status !== 'closed'));
    setPending(orderRows.filter((order) => order.status === 'pending_confirmation'));
    setTables(tableRows);
    return orderRows;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryRows, itemRows] = await Promise.all([api.getCategories(), api.getMenuItems()]);
      setCategories(categoryRows.filter((category) => category.active));
      setItems(itemRows);
      setActiveCategory((current) => current || categoryRows[0]?.id || '');
      await refreshOrders();
    } catch {
      setError('Unable to load the menu and orders.');
    } finally {
      setLoading(false);
    }
  }, [refreshOrders]);

  useEffect(() => {
    void load();
  }, [load]);

  const tableLabel = useCallback(
    (tableId: string) => tables.find((table) => table.id === tableId)?.number ?? '—',
    [tables]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => !activeCategory || item.categoryId === activeCategory),
    [items, activeCategory]
  );

  function chooseItem(item: MenuItem) {
    setSelectedItem(item);
    setVariantId('');
    setNotes('');
    setQuantity(1);
  }

  function addToDraft() {
    if (!selectedItem || !activeOrder) return;
    const variant = selectedItem.variants.find((entry) => entry.id === variantId);
    setDraft((previous) => [
      ...previous,
      {
        key: `${selectedItem.id}:${variant?.id ?? ''}:${Date.now()}`,
        itemId: selectedItem.id,
        variantId: variant?.id ?? null,
        name: selectedItem.name,
        variantName: variant?.name ?? '',
        unitPrice: variant?.price ?? selectedItem.price,
        quantity,
        notes,
      },
    ]);
    setSelectedItem(null);
  }

  async function sendToKitchen() {
    if (!activeOrder || draft.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      let updated = activeOrder;
      for (const line of draft) {
        updated = await api.addOrderItem(activeOrder.id, {
          menuItemId: line.itemId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          quantity: line.quantity,
          notes: line.notes,
        });
      }
      setDraft([]);
      onSelectOrder(updated);
      await refreshOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the order to the kitchen.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(order: RestaurantOrder) {
    if (busy) return;
    setBusy(true);
    try {
      const confirmed = await api.confirmOrder(order.id);
      onSelectOrder(confirmed);
      await refreshOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to confirm the guest order.');
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(itemId: string) {
    if (!activeOrder || busy) return;
    setBusy(true);
    try {
      const updated = await api.removeOrderItem(itemId);
      onSelectOrder(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove that item.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading the menu and orders…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Waiter orders</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Build an order from the menu and send it straight to the kitchen.
        </p>
      </div>

      {error && <ErrorState message={error} />}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-[#111827]">
            Guest orders waiting for confirmation
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                tableNumber={tableLabel(order.tableId)}
                onConfirm={(target) => void confirm(target)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#E6EAF0] bg-white p-4">
        <label htmlFor="active-order" className="text-[13px] font-semibold text-[#374151]">
          Working order
        </label>
        <select
          id="active-order"
          value={activeOrder?.id ?? ''}
          onChange={(event) =>
            onSelectOrder(orders.find((order) => order.id === event.target.value) ?? null)
          }
          className="h-10 min-w-[280px] rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
        >
          <option value="">Select an open order</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.orderNumber} — Table {tableLabel(order.tableId)} ({order.status})
            </option>
          ))}
        </select>
        {activeOrder && <StatusBadge status={activeOrder.status} kind="order" />}
      </div>

      {!activeOrder ? (
        <EmptyState
          title="Select an open order"
          description="Open a table from the Tables screen or choose an existing order above."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`rounded-[9px] px-3 py-1.5 text-[12px] font-semibold ${
                    activeCategory === category.id
                      ? 'bg-[#4F46E5] text-white'
                      : 'border border-[#E6EAF0] bg-white text-[#4B5563] hover:bg-[#F6F8FB]'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {visibleItems.length === 0 ? (
              <EmptyState title="No menu items in this category" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} onSelect={chooseItem} />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            {selectedItem && (
              <div className="rounded-[12px] border border-[#C7D2FE] bg-white p-4">
                <h2 className="text-[14px] font-semibold text-[#111827]">{selectedItem.name}</h2>
                {selectedItem.variants.length > 0 && (
                  <label className="mt-3 block text-[12px] font-medium text-[#4B5563]">
                    Variant
                    <select
                      value={variantId}
                      onChange={(event) => setVariantId(event.target.value)}
                      className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-2 text-[13px]"
                    >
                      <option value="">Standard — {formatMoney(selectedItem.price)}</option>
                      {selectedItem.variants
                        .filter((variant) => variant.available)
                        .map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name} — {formatMoney(variant.price)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="mt-3 block text-[12px] font-medium text-[#4B5563]">
                  Notes
                  <input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="e.g. no onions"
                    className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
                  />
                </label>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280]">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="rounded-[8px] border border-[#E6EAF0] p-1.5 text-[#4B5563]"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-[13px] font-semibold tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                      className="rounded-[8px] border border-[#E6EAF0] p-1.5 text-[#4B5563]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addToDraft}
                  className="mt-4 w-full rounded-[9px] border border-[#4F46E5] bg-[#EEF2FF] px-3 py-2 text-[13px] font-semibold text-[#4338CA] hover:bg-[#E0E7FF]"
                >
                  Add to order
                </button>
              </div>
            )}

            <div className="rounded-[12px] border border-[#E6EAF0] bg-white p-4">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
                <ClipboardList className="h-4 w-4 text-[#4F46E5]" />
                Running order
              </h2>
              <ul className="mt-3 space-y-2">
                {draft.map((line) => (
                  <li key={line.key} className="flex items-start justify-between gap-2 text-[12px]">
                    <span className="min-w-0 text-[#374151]">
                      <span className="font-semibold">{line.quantity}×</span> {line.name}
                      {line.variantName && <span className="text-[#9CA3AF]"> ({line.variantName})</span>}
                      {line.notes && <span className="block text-[#9CA3AF]">Note: {line.notes}</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name} from draft`}
                      onClick={() => setDraft((previous) => previous.filter((entry) => entry.key !== line.key))}
                      className="text-[#9CA3AF] hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {activeOrder.items
                  .filter((line) => line.status !== 'cancelled')
                  .map((line) => (
                    <li key={line.id} className="flex items-start justify-between gap-2 text-[12px]">
                      <span className="min-w-0 text-[#374151]">
                        <span className="font-semibold">{line.quantity}×</span> {line.name}
                        {line.variantName && (
                          <span className="text-[#9CA3AF]"> ({line.variantName})</span>
                        )}
                        {line.notes && <span className="block text-[#9CA3AF]">Note: {line.notes}</span>}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={line.status} kind="item" />
                        {line.status === 'new' && (
                          <button
                            type="button"
                            aria-label={`Remove ${line.name}`}
                            onClick={() => void removeLine(line.id)}
                            className="text-[#9CA3AF] hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                {draft.length === 0 && activeOrder.items.length === 0 && (
                  <li className="py-3 text-center text-[12px] text-[#9CA3AF]">No items yet.</li>
                )}
              </ul>

              <div className="mt-4 flex items-center justify-between border-t border-[#F1F4F8] pt-3 text-[12px]">
                <span className="text-[#6B7280]">Server total</span>
                <span className="font-bold tabular-nums text-[#111827]">
                  {formatMoney(activeOrder.total)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void sendToKitchen()}
                disabled={draft.length === 0 || busy || activeOrder.status === 'pending_confirmation'}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#4F46E5] px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {busy ? 'Sending…' : 'Send to kitchen'}
              </button>
              {draft.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-[#047857]">
                  <Check className="h-3 w-3" /> {draft.length} item(s) ready to send
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
