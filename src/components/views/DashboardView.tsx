import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, LayoutGrid, ReceiptText, TrendingUp, Utensils } from 'lucide-react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import type { DashboardSummary, NavSection } from '../../types/domain';
import { formatMoney } from '../../utils/money';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await api.getDashboard());
    } catch {
      setError('Unable to load the dashboard right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading restaurant overview…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!summary) return <EmptyState title="No overview available" />;

  const cards = [
    {
      label: "Today's sales",
      value: formatMoney(summary.todaySales),
      icon: TrendingUp,
      tone: 'text-[#4F46E5] bg-[#EEF2FF]',
      section: 'billing' as NavSection,
    },
    {
      label: "Today's orders",
      value: String(summary.todayOrders),
      icon: Utensils,
      tone: 'text-[#047857] bg-[#ECFDF5]',
      section: 'waiter-order' as NavSection,
    },
    {
      label: 'Weekly revenue',
      value: formatMoney(summary.weeklyRevenue),
      icon: ReceiptText,
      tone: 'text-[#4338CA] bg-[#EEF2FF]',
      section: 'reports' as NavSection,
    },
    {
      label: 'Open orders',
      value: String(summary.openOrders),
      icon: ClipboardList,
      tone: 'text-[#B45309] bg-[#FFFBEB]',
      section: 'kitchen' as NavSection,
    },
    {
      label: 'Occupied tables',
      value: String(summary.occupiedTables),
      icon: LayoutGrid,
      tone: 'text-[#1D4ED8] bg-[#EFF6FF]',
      section: 'tables' as NavSection,
    },
    {
      label: 'Low stock items',
      value: String(summary.lowStockCount),
      icon: AlertTriangle,
      tone: 'text-[#B91C1C] bg-[#FEF2F2]',
      section: 'inventory' as NavSection,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Overview</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          A live snapshot of the floor, kitchen and stock.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.section)}
              className="rounded-[12px] border border-[#E6EAF0] bg-white p-5 text-left shadow-[0_1px_2px_rgba(17,24,39,0.03)] transition-colors hover:border-[#C7D2FE]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-medium text-[#6B7280]">{card.label}</p>
                  <p className="mt-2 text-[24px] font-bold tabular-nums tracking-[-0.02em] text-[#111827]">
                    {card.value}
                  </p>
                </div>
                <span className={`rounded-[9px] p-2 ${card.tone}`}>
                  <Icon className="h-5 w-5 stroke-[1.75]" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
