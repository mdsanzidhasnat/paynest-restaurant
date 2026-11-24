import { useEffect, useMemo, useState } from 'react';
import { ApiError, publicApi } from '../../api/client';
import {
  PublicCartLine,
  PublicMenuItem,
  PublicMenu,
  PublicOrderResult,
  PublicOrderStatus,
  PublicOrderStatusResult,
} from '../../types/domain';
import { formatMoney } from '../../utils/money';

interface CustomerMenuPageProps {
  token: string;
}

const STATUS_COPY: Record<PublicOrderStatus, string> = {
  pending_confirmation: 'Order received. A waiter will confirm it shortly.',
  new: 'Confirmed — the kitchen has your order.',
  preparing: 'The kitchen is preparing your food.',
  ready: 'Your food is ready and will be served soon.',
  served: 'Served. Enjoy your meal!',
  closed: 'This order has been closed.',
};

function lineKey(itemId: string, variantId?: string): string {
  return variantId ? `${itemId}:${variantId}` : itemId;
}

function unitPrice(line: PublicCartLine): number {
  return line.variant?.price ?? line.item.price;
}

function money(minorUnits: number): string {
  return formatMoney(minorUnits);
}

export function CustomerMenuPage({ token }: CustomerMenuPageProps) {
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, PublicCartLine>>({});
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<PublicOrderResult | null>(null);
  const [status, setStatus] = useState<PublicOrderStatusResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await publicApi.getMenu(token);
        if (!cancelled) setMenu(result);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof ApiError && cause.status === 401
              ? 'This QR code is no longer valid. Please ask the staff for a new one.'
              : 'Unable to load the menu. Please try again.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!placed) return;
    let cancelled = false;
    async function refresh() {
      try {
        const result = await publicApi.getOrderStatus(token, placed!.orderId);
        if (!cancelled) setStatus(result);
      } catch {
        // A temporary network error must not replace the last known status.
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [placed, token]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const total = cartLines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);

  function addItem(item: PublicMenuItem) {
    const variantId = selectedVariants[item.id] || undefined;
    const variant = item.variants.find((entry) => entry.id === variantId) ?? null;
    const key = lineKey(item.id, variant?.id);
    setCart((previous) => {
      const existing = previous[key];
      return {
        ...previous,
        [key]: existing
          ? { ...existing, quantity: Math.min(20, existing.quantity + 1) }
          : { key, item, variant, quantity: 1, note: '' },
      };
    });
  }

  function changeQuantity(key: string, delta: number) {
    setCart((previous) => {
      const line = previous[key];
      if (!line) return previous;
      const quantity = line.quantity + delta;
      if (quantity <= 0) {
        const next = { ...previous };
        delete next[key];
        return next;
      }
      return { ...previous, [key]: { ...line, quantity: Math.min(20, quantity) } };
    });
  }

  function updateNote(key: string, note: string) {
    setCart((previous) =>
      previous[key] ? { ...previous, [key]: { ...previous[key], note } } : previous
    );
  }

  async function placeOrder() {
    if (!cartLines.length || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await publicApi.placeOrder(token, cartLines);
      setPlaced(result);
      setStatus(null);
      setCart({});
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not place the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] text-[#111827] flex items-center justify-center text-[14px] text-[#6B7280]">
        Loading menu…
      </div>
    );
  }

  if (!menu && error) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] text-[#111827] flex items-center justify-center p-6">
        <div className="pos-card max-w-sm w-full p-6 text-center">
          <div className="text-[16px] font-semibold">Menu unavailable</div>
          <p className="mt-2 text-[13px] text-[#6B7280]">{error}</p>
        </div>
      </div>
    );
  }

  if (!menu) return null;

  const currentStatus = status?.status ?? placed?.status ?? 'pending_confirmation';

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#111827] pb-40">
      <header className="bg-[#4F46E5] text-white px-4 py-5 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="text-[12px] font-medium uppercase tracking-wide text-white/75">
            {menu.table.label}
          </div>
          <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{menu.restaurantName}</h1>
          <p className="mt-1 text-[13px] text-white/85">Scan, choose and order — no login needed.</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5">
        {error && (
          <div className="mb-4 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-[13px] font-medium text-[#92400E]">
            {error}
          </div>
        )}

        {placed ? (
          <section className="pos-card p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[22px]">
              ✓
            </div>
            <h2 className="mt-3 text-[18px] font-bold">Order received</h2>
            <p className="mt-1 text-[13px] text-[#6B7280]">{placed.tableLabel}</p>
            <div className="mt-4 rounded-[10px] bg-[#EEF2FF] px-4 py-3 text-[14px] font-semibold text-[#3730A3]">
              {STATUS_COPY[currentStatus]}
            </div>
            <p className="mt-2 text-[12px] text-[#9CA3AF]">
              Order #{placed.orderId.slice(-6).toUpperCase()} · updates automatically
            </p>
            {status?.items && status.items.length > 0 && (
              <ul className="mt-4 space-y-2 text-left">
                {status.items.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-center justify-between rounded-[9px] border border-[#E6EAF0] px-3 py-2 text-[13px]"
                  >
                    <span>{line.name}</span>
                    <span className="ml-3 text-[11px] font-semibold uppercase text-[#4F46E5]">
                      {line.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setPlaced(null);
                setStatus(null);
              }}
              className="mt-5 rounded-[10px] border border-[#D1D5DB] px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F6F8FB]"
            >
              Order something else
            </button>
          </section>
        ) : (
          <div className="space-y-7">
            {menu.categories.map((category) => (
              <section key={category.id}>
                <div className="mb-3">
                  <h2 className="text-[17px] font-bold tracking-[-0.01em]">{category.name}</h2>
                  {category.description && (
                    <p className="mt-0.5 text-[12px] text-[#6B7280]">{category.description}</p>
                  )}
                </div>
                <div className="space-y-3">
                  {category.items.map((item) => (
                    <article key={item.id} className="pos-card flex gap-3 p-3">
                      <img
                        src={item.image || '/images/dish_biryani.svg'}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-[9px] border border-[#E6EAF0] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-semibold leading-tight">{item.name}</h3>
                          <span className="shrink-0 text-[14px] font-bold text-[#4F46E5]">
                            {money(item.price)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#6B7280]">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            aria-label={`Variant for ${item.name}`}
                            value={selectedVariants[item.id] ?? ''}
                            onChange={(event) =>
                              setSelectedVariants((previous) => ({
                                ...previous,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 rounded-[8px] border border-[#E6EAF0] bg-white px-2 py-1.5 text-[12px] text-[#374151]"
                          >
                            <option value="">Regular · {money(item.price)}</option>
                            {item.variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.name} · {money(variant.price)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => addItem(item)}
                            className="shrink-0 rounded-[8px] bg-[#4F46E5] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4338CA]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {menu.categories.length === 0 && (
              <p className="pos-card p-5 text-center text-[13px] text-[#6B7280]">
                No items are available right now.
              </p>
            )}
          </div>
        )}
      </main>

      {!placed && cartLines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#E6EAF0] bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(17,24,39,0.06)] backdrop-blur">
          <div className="mx-auto max-w-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#374151]">
                Your order · {itemCount} item{itemCount === 1 ? '' : 's'}
              </span>
              <span className="text-[15px] font-bold text-[#111827]">{money(total)}</span>
            </div>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {cartLines.map((line) => (
                <div key={line.key} className="rounded-[9px] border border-[#E6EAF0] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-[12px]">
                      <span className="font-semibold">{line.item.name}</span>
                      {line.variant && <span className="text-[#6B7280]"> · {line.variant.name}</span>}
                      <div className="text-[#6B7280]">{money(unitPrice(line) * line.quantity)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Remove one ${line.item.name}`}
                        onClick={() => changeQuantity(line.key, -1)}
                        className="h-7 w-7 rounded-[7px] border border-[#D1D5DB] text-[15px] text-[#374151]"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-[13px] font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${line.item.name}`}
                        onClick={() => changeQuantity(line.key, 1)}
                        className="h-7 w-7 rounded-[7px] border border-[#D1D5DB] text-[15px] text-[#374151]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    value={line.note}
                    maxLength={140}
                    onChange={(event) => updateNote(line.key, event.target.value)}
                    placeholder="Note for kitchen (optional)"
                    className="mt-2 w-full rounded-[7px] border border-[#E6EAF0] px-2 py-1 text-[12px] outline-none focus:border-[#4F46E5]"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={submitting}
              className="mt-3 w-full rounded-[10px] bg-[#4F46E5] py-3 text-[14px] font-bold text-white hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Sending…' : `Place order · ${money(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
