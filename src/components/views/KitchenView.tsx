import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, ChefHat } from 'lucide-react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { KitchenTimer } from '../common/KitchenTimer';
import type { KitchenTicket } from '../../types/domain';

const COLUMNS: {
  status: 'new' | 'preparing' | 'ready';
  title: string;
  action?: string;
  next?: 'preparing' | 'ready';
}[] = [
  { status: 'new', title: 'New', action: 'Start preparing', next: 'preparing' },
  { status: 'preparing', title: 'Preparing', action: 'Mark ready', next: 'ready' },
  { status: 'ready', title: 'Ready' },
];

function playChime() {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.05, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    void context.close();
  } catch {
    // Sound is optional; a blocked audio context must never break the board.
  }
}

export function KitchenView() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const [busyId, setBusyId] = useState('');
  const knownIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await api.getKitchenTickets();
      setTickets(rows);
      setError('');
    } catch {
      setError('Unable to refresh kitchen tickets. Retrying automatically.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const ids = new Set(tickets.map((ticket) => ticket.id));
    if (sound && knownIds.current !== null) {
      const isNew = tickets.some((ticket) => !knownIds.current?.has(ticket.id));
      if (isNew) playChime();
    }
    knownIds.current = ids;
  }, [tickets, sound]);

  async function advance(ticket: KitchenTicket, next: 'preparing' | 'ready') {
    if (busyId) return;
    setBusyId(ticket.id);
    try {
      await api.setKitchenItemStatus(ticket.id, next);
      setTickets((previous) =>
        previous.map((entry) => (entry.id === ticket.id ? { ...entry, status: next } : entry))
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update that item.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Kitchen display</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Live tickets, refreshed every few seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSound((enabled) => !enabled)}
          aria-pressed={sound}
          className="inline-flex items-center gap-2 rounded-[9px] border border-[#E6EAF0] bg-white px-3 py-2 text-[12px] font-semibold text-[#4B5563] hover:bg-[#F6F8FB]"
        >
          {sound ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          Sound {sound ? 'on' : 'off'}
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading kitchen tickets…" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
            return (
              <section key={column.status} className="rounded-[12px] border border-[#E6EAF0] bg-[#F6F8FB] p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-bold text-[#111827]">{column.title}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#6B7280]">
                    {columnTickets.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {columnTickets.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-[#E6EAF0] bg-white px-3 py-8 text-center text-[12px] text-[#9CA3AF]">
                      Nothing here
                    </p>
                  ) : (
                    columnTickets.map((ticket) => (
                      <article
                        key={ticket.id}
                        className="rounded-[12px] border border-[#E6EAF0] bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-bold text-[#111827]">
                              Table {ticket.tableNumber}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                              {ticket.orderNumber} · {ticket.floorName}
                            </p>
                          </div>
                          <KitchenTimer createdAt={ticket.createdAt} />
                        </div>
                        <p className="mt-3 text-[18px] font-bold text-[#111827]">
                          <span className="tabular-nums text-[#4F46E5]">{ticket.quantity}×</span>{' '}
                          {ticket.name}
                        </p>
                        {ticket.variantName && (
                          <p className="text-[12px] text-[#6B7280]">{ticket.variantName}</p>
                        )}
                        {ticket.notes && (
                          <p className="mt-2 rounded-[8px] bg-[#FFFBEB] px-2.5 py-2 text-[12px] text-[#92400E]">
                            {ticket.notes}
                          </p>
                        )}
                        {column.action && column.next ? (
                          <button
                            type="button"
                            disabled={busyId === ticket.id}
                            onClick={() => void advance(ticket, column.next!)}
                            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#4F46E5] px-3 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
                          >
                            <ChefHat className="h-4 w-4" />
                            {busyId === ticket.id ? 'Updating…' : column.action}
                          </button>
                        ) : (
                          <p className="mt-4 text-center text-[11px] font-medium text-[#6B7280]">
                            Ready for the waiter to serve
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!loading && tickets.length === 0 && (
        <EmptyState title="The kitchen is clear" description="New tickets will appear automatically." />
      )}
    </div>
  );
}
