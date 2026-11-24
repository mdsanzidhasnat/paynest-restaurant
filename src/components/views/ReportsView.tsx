import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../common/AsyncState';
import type { DailySalesRow, TableTurnoverRow, TopItemRow } from '../../types/pos';
import { dateRangeForPreset, type DateRangePreset } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '14d', label: 'Last 14 days' },
  { id: '30d', label: 'Last 30 days' },
];

export function ReportsView() {
  const [daily, setDaily] = useState<DailySalesRow[]>([]);
  const [topItems, setTopItems] = useState<TopItemRow[]>([]);
  const [turnover, setTurnover] = useState<TableTurnoverRow[]>([]);
  const [preset, setPreset] = useState<DateRangePreset>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dailyRows, topRows, turnoverRows] = await Promise.all([
        api.getDailySales(),
        api.getTopItems(),
        api.getTableTurnover(),
      ]);
      setDaily(dailyRows);
      setTopItems(topRows);
      setTurnover(turnoverRows);
    } catch {
      setError('Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const range = useMemo(() => dateRangeForPreset(preset), [preset]);
  const rows = useMemo(
    () =>
      daily.filter(
        (row) => row.salesDate >= range.startDate && row.salesDate <= range.endDate
      ),
    [daily, range]
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          sales: sum.sales + row.sales,
          orders: sum.orders + row.orders,
          vat: sum.vat + row.vat,
          serviceCharge: sum.serviceCharge + row.serviceCharge,
        }),
        { sales: 0, orders: 0, vat: 0, serviceCharge: 0 }
      ),
    [rows]
  );

  if (loading) return <LoadingState label="Loading reports…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Reports</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Sales, popular items and table turnover.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPreset(option.id)}
              className={`rounded-[9px] px-3 py-1.5 text-[12px] font-semibold ${
                preset === option.id
                  ? 'bg-[#4F46E5] text-white'
                  : 'border border-[#E6EAF0] bg-white text-[#4B5563] hover:bg-[#F6F8FB]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      <p className="text-[12px] text-[#9CA3AF]">
        {range.startDate} to {range.endDate}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Sales', value: formatMoney(totals.sales) },
          { label: 'Orders', value: String(totals.orders) },
          { label: 'VAT', value: formatMoney(totals.vat) },
          { label: 'Service charge', value: formatMoney(totals.serviceCharge) },
        ].map((card) => (
          <div key={card.label} className="rounded-[12px] border border-[#E6EAF0] bg-white p-5">
            <p className="text-[12px] text-[#6B7280]">{card.label}</p>
            <p className="mt-2 text-[22px] font-bold tabular-nums text-[#111827]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[12px] border border-[#E6EAF0] bg-white">
          <h2 className="border-b border-[#E6EAF0] px-5 py-3 text-[14px] font-semibold text-[#111827]">
            Daily sales
          </h2>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-[#9CA3AF]">
                <tr>
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Orders</th>
                  <th className="px-5 py-2 text-right font-semibold">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F4F8]">
                {rows.map((row) => (
                  <tr key={row.salesDate}>
                    <td className="px-5 py-2 text-[#374151]">{row.dateLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#6B7280]">{row.orders}</td>
                    <td className="px-5 py-2 text-right tabular-nums text-[#111827]">
                      {formatMoney(row.sales)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-[#9CA3AF]">
                      No sales in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[12px] border border-[#E6EAF0] bg-white">
          <h2 className="border-b border-[#E6EAF0] px-5 py-3 text-[14px] font-semibold text-[#111827]">
            Top items
          </h2>
          <ul className="divide-y divide-[#F1F4F8]">
            {topItems.map((item, index) => (
              <li key={item.menuItemId} className="flex items-center gap-3 px-5 py-3 text-[12px]">
                <span className="w-5 text-[11px] font-semibold text-[#9CA3AF]">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[#374151]">{item.name}</span>
                <span className="tabular-nums text-[#6B7280]">{item.quantity} sold</span>
                <span className="w-24 text-right font-semibold tabular-nums text-[#111827]">
                  {formatMoney(item.revenue)}
                </span>
              </li>
            ))}
            {topItems.length === 0 && (
              <li className="px-5 py-8 text-center text-[12px] text-[#9CA3AF]">No items sold yet.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-[12px] border border-[#E6EAF0] bg-white">
        <h2 className="border-b border-[#E6EAF0] px-5 py-3 text-[14px] font-semibold text-[#111827]">
          Table turnover
        </h2>
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-[#9CA3AF]">
              <tr>
                <th className="px-5 py-2 font-semibold">Table</th>
                <th className="px-3 py-2 font-semibold">Floor</th>
                <th className="px-3 py-2 text-right font-semibold">Completed orders</th>
                <th className="px-5 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8]">
              {turnover.map((row) => (
                <tr key={row.tableId}>
                  <td className="px-5 py-2 font-semibold text-[#111827]">Table {row.tableNumber}</td>
                  <td className="px-3 py-2 text-[#6B7280]">{row.floor}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#6B7280]">
                    {row.completedOrders}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums text-[#111827]">
                    {formatMoney(row.revenue)}
                  </td>
                </tr>
              ))}
              {turnover.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#9CA3AF]">
                    No tables to report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
