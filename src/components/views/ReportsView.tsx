import React, { useState } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Category, DailySalesPoint, Product, SaleInvoice } from '../../types/pos';
import { formatBDT } from '../../utils/format';
import { dateRangeForPreset } from '../../utils/dates';
import { ProductThumb } from '../common/ProductThumb';

interface ReportsViewProps {
  weeklySales: DailySalesPoint[];
  categories: Category[];
  invoices: SaleInvoice[];
  products: Product[];
}

type DatePreset = '7d' | '14d' | '30d';

interface ReportDayRow {
  dateLabel: string;
  day: string;
  orders: number;
  revenue: number;
  expense: number;
  profit: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  weeklySales,
  products,
}) => {
  const [preset, setPreset] = useState<DatePreset>('7d');
  const [startDate, setStartDate] = useState(() => dateRangeForPreset('7d').startDate);
  const [endDate, setEndDate] = useState(() => dateRangeForPreset('7d').endDate);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const handlePresetChange = (next: DatePreset) => {
    setPreset(next);
    const range = dateRangeForPreset(next);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // Build deterministic report rows for 7d / 14d / 30d (anchored on live weeklySales for last 7 days)
  const priorWeekRows: ReportDayRow[] = [
    { dateLabel: '08 Nov', day: 'Sun', orders: 88, revenue: 33800, expense: 27040, profit: 6760 },
    { dateLabel: '09 Nov', day: 'Mon', orders: 96, revenue: 37400, expense: 29800, profit: 7600 },
    { dateLabel: '10 Nov', day: 'Tue', orders: 91, revenue: 35200, expense: 28160, profit: 7040 },
    { dateLabel: '11 Nov', day: 'Wed', orders: 104, revenue: 40100, expense: 31980, profit: 8120 },
    { dateLabel: '12 Nov', day: 'Thu', orders: 99, revenue: 38600, expense: 30880, profit: 7720 },
    { dateLabel: '13 Nov', day: 'Fri', orders: 109, revenue: 41950, expense: 33450, profit: 8500 },
    { dateLabel: '14 Nov', day: 'Sat', orders: 118, revenue: 45100, expense: 35920, profit: 9180 },
  ];

  const current7DaysRows: ReportDayRow[] = weeklySales.map((d) => ({
    dateLabel: `${d.dateLabel} 2026`,
    day: d.day,
    orders: d.orders,
    revenue: d.sales,
    expense: Math.max(d.sales - d.profit, 0),
    profit: d.profit,
  }));

  const reportRows: ReportDayRow[] =
    preset === '7d'
      ? current7DaysRows
      : preset === '14d'
        ? [
            ...priorWeekRows.map((r) => ({ ...r, dateLabel: `${r.dateLabel} 2026` })),
            ...current7DaysRows,
          ]
        : [
            ...priorWeekRows.map((r, i) => ({
              ...r,
              dateLabel: `${String(i + 1).padStart(2, '0')} Nov 2026`,
              revenue: Math.round(r.revenue * 0.96),
              expense: Math.round(r.expense * 0.96),
              profit: Math.round(r.profit * 0.96),
            })),
            ...priorWeekRows.map((r) => ({ ...r, dateLabel: `${r.dateLabel} 2026` })),
            ...current7DaysRows,
          ];

  const totalOrders = reportRows.reduce((s, r) => s + r.orders, 0);
  const totalRevenue = reportRows.reduce((s, r) => s + r.revenue, 0);
  const totalExpense = reportRows.reduce((s, r) => s + r.expense, 0);
  const totalProfit = reportRows.reduce((s, r) => s + r.profit, 0);

  // Payment method distribution scaled realistically to totalRevenue
  const paymentBreakdown = [
    { method: 'Cash', share: 44, amount: Math.round(totalRevenue * 0.44), color: '#4F46E5' },
    { method: 'bKash', share: 28, amount: Math.round(totalRevenue * 0.28), color: '#10B981' },
    { method: 'Nagad', share: 16, amount: Math.round(totalRevenue * 0.16), color: '#F59E0B' },
    { method: 'Card', share: 12, amount: Math.round(totalRevenue * 0.12), color: '#0EA5E9' },
  ];

  // Top 5 Products by weekly revenue
  const top5Products = [...products]
    .sort((a, b) => b.soldThisWeek * b.sellPrice - a.soldThisWeek * a.sellPrice)
    .slice(0, 5);
  const maxTop5Rev = Math.max(
    ...top5Products.map((p) => p.soldThisWeek * p.sellPrice),
    1
  );

  // Bar chart geometry (use last 7 or 14 bars for crisp display)
  const chartRows = reportRows.slice(-14);
  const barChartW = 680;
  const barChartH = 250;
  const padL = 56;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const innerW = barChartW - padL - padR;
  const innerH = barChartH - padT - padB;
  const maxBarVal = Math.max(...chartRows.map((r) => r.revenue), 1000);
  const niceBarMax = Math.ceil((maxBarVal * 1.15) / 10000) * 10000;
  const slotW = innerW / Math.max(chartRows.length, 1);
  const singleBarW = Math.min(Math.max(slotW * 0.28, 8), 22);

  // Donut chart geometry
  const donutSize = 180;
  const donutStroke = 24;
  const donutRadius = (donutSize - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumPct = 0;
  const donutSegments = paymentBreakdown.map((seg) => {
    const start = accumPct;
    accumPct += seg.share;
    return {
      ...seg,
      dashLength: (seg.share / 100) * donutCircumference,
      dashOffset: -((start / 100) * donutCircumference),
    };
  });
  const activeMethodObj = paymentBreakdown.find((m) => m.method === hoveredMethod);

  const handleExportExcel = () => {
    const csvRows = [
      ['Date', 'Day', 'Orders', 'Revenue (BDT)', 'Expense (BDT)', 'Profit (BDT)'],
      ...reportRows.map((r) => [
        r.dateLabel,
        r.day,
        r.orders.toString(),
        r.revenue.toString(),
        r.expense.toString(),
        r.profit.toString(),
      ]),
      ['TOTAL', '', totalOrders.toString(), totalRevenue.toString(), totalExpense.toString(), totalProfit.toString()],
    ];
    const csv = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PayNest-Sales-Report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported Excel (CSV) financial report');
  };

  const handleExportPdf = () => {
    window.print();
    showToast('Opened print-ready PDF export');
  };

  return (
    <div className="space-y-6">
      {/* Header Row: Title + Date Range Picker + Export (PDF / Excel) Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Reports</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Revenue vs profit analytics, payment channel split &amp; top products
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          {toast && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[12.5px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              {toast}
            </span>
          )}

          {/* Date Range Picker */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-[#E6EAF0] rounded-[10px] px-3 py-1.5">
            <Calendar className="w-4 h-4 text-[#4F46E5] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
              className="text-[13px] font-medium text-[#111827] tabular-nums focus:outline-none bg-transparent"
            />
            <span className="text-[#9CA3AF] text-[12px]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
              className="text-[13px] font-medium text-[#111827] tabular-nums focus:outline-none bg-transparent"
            />
            <div className="h-4 w-px bg-[#E6EAF0] mx-1 hidden sm:block" />
            <div className="flex items-center gap-1">
              {(['7d', '14d', '30d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={`px-2 py-1 rounded-[6px] text-[11.5px] font-semibold transition-colors ${
                    preset === p
                      ? 'bg-[#EEF2FF] text-[#4F46E5]'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#111827] text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#EF4444] stroke-[1.75]" />
            Export PDF
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 stroke-[1.75]" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Charts Row 1: Revenue vs Profit Bar Chart (left) + Sales by Payment Method Donut (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* 1. Revenue vs Profit Bar Chart */}
        <div className="xl:col-span-8 pos-card p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">Revenue vs Profit</h2>
              <p className="text-[13px] text-[#9CA3AF] mt-0.5 tabular-nums">
                Total Revenue{' '}
                <span className="font-semibold text-[#111827]">{formatBDT(totalRevenue)}</span> ·
                Net Profit{' '}
                <span className="font-semibold text-[#10B981]">{formatBDT(totalProfit)}</span>
              </p>
            </div>

            <div className="flex items-center gap-4 text-[12.5px] font-medium text-[#4B5563]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#4F46E5]" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#10B981]" />
                Profit
              </span>
            </div>
          </div>

          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${barChartW} ${barChartH}`}
              className="w-full h-auto overflow-visible select-none"
              role="img"
              aria-label="Revenue vs Profit grouped bar chart"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padT + innerH - ratio * innerH;
                const val = Math.round(niceBarMax * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={barChartW - padR}
                      y2={y}
                      stroke="#E6EAF0"
                      strokeDasharray={idx === 0 ? undefined : '4 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#9CA3AF] text-[11px] tabular-nums"
                    >
                      {val === 0 ? '৳0' : `৳${Math.round(val / 1000)}k`}
                    </text>
                  </g>
                );
              })}

              {chartRows.map((row, idx) => {
                const centerX = padL + idx * slotW + slotW / 2;
                const revH = Math.max((row.revenue / niceBarMax) * innerH, 3);
                const profH = Math.max((row.profit / niceBarMax) * innerH, 3);
                const revY = padT + innerH - revH;
                const profY = padT + innerH - profH;
                const isHovered = hoveredBarIdx === idx;

                return (
                  <g key={`${row.dateLabel}-${idx}`}>
                    {isHovered && (
                      <rect
                        x={centerX - slotW * 0.44}
                        y={padT}
                        width={slotW * 0.88}
                        height={innerH}
                        rx="6"
                        fill="#F6F8FB"
                      />
                    )}
                    {/* Revenue Bar */}
                    <rect
                      x={centerX - singleBarW - 2}
                      y={revY}
                      width={singleBarW}
                      height={revH}
                      rx="4"
                      fill="#4F46E5"
                      className="transition-opacity duration-150"
                      style={{ opacity: hoveredBarIdx === null || isHovered ? 1 : 0.6 }}
                    />
                    {/* Profit Bar */}
                    <rect
                      x={centerX + 2}
                      y={profY}
                      width={singleBarW}
                      height={profH}
                      rx="4"
                      fill="#10B981"
                      className="transition-opacity duration-150"
                      style={{ opacity: hoveredBarIdx === null || isHovered ? 1 : 0.6 }}
                    />

                    <text
                      x={centerX}
                      y={barChartH - 8}
                      textAnchor="middle"
                      className={`text-[11px] tabular-nums ${
                        isHovered ? 'fill-[#111827] font-semibold' : 'fill-[#9CA3AF]'
                      }`}
                    >
                      {chartRows.length > 8 ? row.dateLabel.slice(0, 2) : row.day}
                    </text>

                    <rect
                      x={centerX - slotW / 2}
                      y={padT}
                      width={slotW}
                      height={innerH + 24}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredBarIdx(idx)}
                      onMouseLeave={() => setHoveredBarIdx(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {hoveredBarIdx !== null && chartRows[hoveredBarIdx] && (
              <div
                className="pointer-events-none absolute top-1 bg-[#111827] text-white px-3 py-2 rounded-[10px] shadow-md text-[12px] z-10 whitespace-nowrap"
                style={{
                  left: `${Math.min(
                    Math.max(((hoveredBarIdx + 0.5) / chartRows.length) * 85 + 8, 15),
                    82
                  )}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <p className="font-semibold">
                  {chartRows[hoveredBarIdx].day}, {chartRows[hoveredBarIdx].dateLabel}
                </p>
                <p className="tabular-nums mt-0.5">
                  Revenue: <span className="font-bold">{formatBDT(chartRows[hoveredBarIdx].revenue)}</span>
                </p>
                <p className="tabular-nums text-[#34D399]">
                  Profit: <span className="font-bold">{formatBDT(chartRows[hoveredBarIdx].profit)}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 2. Sales by Payment Method Donut Chart */}
        <div className="xl:col-span-4 pos-card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827]">Sales by Payment Method</h2>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Share across Cash, bKash, Nagad &amp; Card</p>
          </div>

          <div className="flex items-center justify-center my-4">
            <div className="relative w-[180px] h-[180px]">
              <svg
                viewBox={`0 0 ${donutSize} ${donutSize}`}
                className="w-full h-full -rotate-90"
                role="img"
                aria-label="Sales by payment method donut chart"
              >
                <circle
                  cx={donutSize / 2}
                  cy={donutSize / 2}
                  r={donutRadius}
                  fill="none"
                  stroke="#F3F5F9"
                  strokeWidth={donutStroke}
                />
                {donutSegments.map((seg) => {
                  const active = hoveredMethod === null || hoveredMethod === seg.method;
                  return (
                    <circle
                      key={seg.method}
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={hoveredMethod === seg.method ? donutStroke + 4 : donutStroke}
                      strokeDasharray={`${Math.max(seg.dashLength - 2, 0)} ${donutCircumference}`}
                      strokeDashoffset={seg.dashOffset}
                      className="cursor-pointer transition-all duration-150"
                      style={{ opacity: active ? 1 : 0.35 }}
                      onMouseEnter={() => setHoveredMethod(seg.method)}
                      onMouseLeave={() => setHoveredMethod(null)}
                    />
                  );
                })}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
                <span className="text-[11.5px] font-medium text-[#9CA3AF]">
                  {activeMethodObj ? activeMethodObj.method : 'Total Sales'}
                </span>
                <span className="text-[17px] font-bold text-[#111827] tabular-nums mt-0.5">
                  {activeMethodObj ? formatBDT(activeMethodObj.amount) : formatBDT(totalRevenue)}
                </span>
                {activeMethodObj && (
                  <span className="text-[11.5px] font-semibold text-[#4F46E5] tabular-nums">
                    {activeMethodObj.share}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {paymentBreakdown.map((m) => (
              <div
                key={m.method}
                onMouseEnter={() => setHoveredMethod(m.method)}
                onMouseLeave={() => setHoveredMethod(null)}
                className={`flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-[8px] cursor-pointer transition-colors ${
                  hoveredMethod === m.method ? 'bg-[#F6F8FB]' : ''
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="font-medium text-[#4B5563]">{m.method}</span>
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="text-[#9CA3AF] text-[12px]">{formatBDT(m.amount)}</span>
                  <span className="font-semibold text-[#111827] w-9 text-right">{m.share}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Top 5 Products Horizontal Bar Chart */}
      <div className="pos-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827]">Top 5 Products</h2>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">
              Highest-grossing items ranked by weekly revenue
            </p>
          </div>
          <span className="text-[12.5px] font-medium text-[#4B5563] tabular-nums">
            Units &amp; revenue (৳)
          </span>
        </div>

        <div className="space-y-4">
          {top5Products.map((product, idx) => {
            const rev = product.soldThisWeek * product.sellPrice;
            const pct = Math.max(Math.round((rev / maxTop5Rev) * 100), 10);
            const barColors = ['#4F46E5', '#6366F1', '#10B981', '#0EA5E9', '#8B5CF6'];
            return (
              <div
                key={product.id}
                className="grid grid-cols-1 md:grid-cols-[280px_1fr_140px] items-center gap-3 md:gap-5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-[12.5px] font-semibold text-[#9CA3AF] tabular-nums shrink-0">
                    {idx + 1}.
                  </span>
                  <ProductThumb src={product.image} alt={product.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#111827] truncate">
                      {product.name}
                    </p>
                    <p className="text-[11.5px] text-[#9CA3AF] tabular-nums">
                      {product.soldThisWeek} units sold
                    </p>
                  </div>
                </div>

                <div className="h-3 bg-[#F1F4F8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: barColors[idx % barColors.length] }}
                  />
                </div>

                <div className="text-left md:text-right text-[14px] font-bold text-[#111827] tabular-nums">
                  {formatBDT(rev)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Table Below: Date, Orders, Revenue, Expense, Profit */}
      <div className="pos-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6EAF0] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827]">Daily Financial Summary</h2>
            <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 tabular-nums">
              {startDate} to {endDate} · {reportRows.length} days
            </p>
          </div>
          <span className="text-[12.5px] font-medium text-[#4B5563] tabular-nums">
            Avg Margin: {((totalProfit / Math.max(totalRevenue, 1)) * 100).toFixed(1)}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-3">Date</th>
                <th className="py-3.5 px-3 text-right">Orders</th>
                <th className="py-3.5 px-3 text-right">Revenue</th>
                <th className="py-3.5 px-3 text-right">Expense</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {reportRows.map((row, idx) => (
                <tr key={`${row.dateLabel}-${idx}`} className="hover:bg-[#F6F8FB] transition-colors">
                  <td className="py-3.5 pl-6 pr-3 font-medium text-[#111827] tabular-nums">
                    {row.day}, {row.dateLabel}
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#4B5563] tabular-nums">
                    {row.orders.toLocaleString('en-US')}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold text-[#111827] tabular-nums">
                    {formatBDT(row.revenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#4B5563] tabular-nums">
                    {formatBDT(row.expense)}
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right font-semibold text-[#10B981] tabular-nums">
                    {formatBDT(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#E6EAF0] bg-[#FAFBFD] text-[14px] font-bold text-[#111827]">
                <td className="py-4 pl-6 pr-3">Total ({reportRows.length} days)</td>
                <td className="py-4 px-3 text-right tabular-nums">
                  {totalOrders.toLocaleString('en-US')}
                </td>
                <td className="py-4 px-3 text-right tabular-nums">{formatBDT(totalRevenue)}</td>
                <td className="py-4 px-3 text-right text-[#4B5563] tabular-nums">
                  {formatBDT(totalExpense)}
                </td>
                <td className="py-4 pl-3 pr-6 text-right text-[#10B981] tabular-nums">
                  {formatBDT(totalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
