import React, { useState } from 'react';
import {
  Banknote,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  Download,
} from 'lucide-react';
import {
  Category,
  DailySalesPoint,
  NavSection,
  Product,
  SaleInvoice,
} from '../../types/pos';
import { formatBDT, formatNumber } from '../../utils/format';
import { SalesOverviewChart } from '../charts/SalesOverviewChart';
import { CategoryDonutChart } from '../charts/CategoryDonutChart';
import { ProductThumb } from '../common/ProductThumb';

interface DashboardViewProps {
  todaySales: number;
  totalOrders: number;
  totalProfit: number;
  lowStockCount: number;
  weeklySales: DailySalesPoint[];
  categories: Category[];
  invoices: SaleInvoice[];
  products: Product[];
  onNavigate: (section: NavSection) => void;
  onInspectInvoice: (invoice: SaleInvoice) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  todaySales,
  totalOrders,
  totalProfit,
  lowStockCount,
  weeklySales,
  categories,
  invoices,
  products,
  onNavigate,
  onInspectInvoice,
}) => {
  const [recentFilter, setRecentFilter] = useState<'All' | 'Paid' | 'Due'>('All');

  const filteredInvoices = invoices
    .filter((inv) => (recentFilter === 'All' ? true : inv.paymentStatus === recentFilter))
    .slice(0, 6);

  // Top Selling Products sorted by revenue/sold units
  const topProducts = [...products]
    .sort((a, b) => b.soldToday * b.sellPrice - a.soldToday * a.sellPrice)
    .slice(0, 5);

  const maxProductRevenue = Math.max(
    ...topProducts.map((p) => p.soldToday * p.sellPrice),
    1
  );

  const avgOrderValue = totalOrders > 0 ? Math.round(todaySales / totalOrders) : 0;
  const profitMarginPct = todaySales > 0 ? ((totalProfit / todaySales) * 100).toFixed(1) : '0.0';

  const handleExportSummary = () => {
    const csvRows = [
      ['Invoice #', 'Customer', 'Amount (BDT)', 'Status', 'Method', 'Time'],
      ...invoices.map((inv) => [
        inv.invoiceNumber,
        inv.customerName,
        inv.amount.toString(),
        inv.paymentStatus,
        inv.paymentMethod,
        inv.time,
      ]),
    ];
    const csvContent = csvRows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'paynest-daily-summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Dashboard</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Store performance summary · Dhanmondi Branch
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportSummary}
            className="h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#111827] text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#4B5563] stroke-[1.75]" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            New Sale (POS)
          </button>
        </div>
      </div>

      {/* Top Row: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Today's Sales */}
        <div className="pos-card p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#4B5563]">Today&apos;s Sales</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1.5 leading-tight">
              {formatBDT(todaySales)}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-[12.5px]">
              <span className="inline-flex items-center gap-0.5 font-semibold text-[#10B981] tabular-nums">
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.25]" />
                +12%
              </span>
              <span className="text-[#9CA3AF]">vs yesterday</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="pos-card p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#4B5563]">Total Orders</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1.5 leading-tight">
              {formatNumber(totalOrders)}
            </p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-2 tabular-nums">
              Avg ticket <span className="font-medium text-[#4B5563]">{formatBDT(avgOrderValue)}</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#F0F9FF] text-[#0EA5E9] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 3: Total Profit */}
        <div className="pos-card p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#4B5563]">Total Profit</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1.5 leading-tight">
              {formatBDT(totalProfit)}
            </p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-2 tabular-nums">
              <span className="font-semibold text-[#10B981]">{profitMarginPct}%</span> gross margin
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 4: Low Stock Items */}
        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="pos-card p-5 flex items-start justify-between gap-4 text-left hover:border-[#FCA5A5] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#4B5563]">Low Stock Items</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1.5 leading-tight">
              {formatNumber(lowStockCount)}
            </p>
            <p className="text-[12.5px] font-medium text-[#EF4444] mt-2">
              {lowStockCount > 0 ? 'Reorder attention needed' : 'All stock healthy'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 stroke-[1.75]" />
          </div>
        </button>
      </div>

      {/* Middle Row: Sales Overview Chart (left) + Sales by Category Donut (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-8">
          <SalesOverviewChart data={weeklySales} />
        </div>
        <div className="xl:col-span-4">
          <CategoryDonutChart categories={categories} totalSales={todaySales} />
        </div>
      </div>

      {/* Bottom Row: Recent Sales Table (left) + Top Selling Products (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Recent Sales Table */}
        <div className="xl:col-span-7 pos-card flex flex-col">
          <div className="px-6 py-4 border-b border-[#E6EAF0] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">Recent Sales</h2>
              <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">Click any invoice row to inspect receipt</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px]">
                {(['All', 'Paid', 'Due'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setRecentFilter(status)}
                    className={`px-2.5 py-1 text-[12px] font-medium rounded-[7px] transition-colors whitespace-nowrap ${
                      recentFilter === status
                        ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                        : 'text-[#4B5563] hover:text-[#111827]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sales-history')}
                className="text-[13px] font-medium text-[#4F46E5] hover:text-[#4338CA] whitespace-nowrap"
              >
                View all
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                  <th className="py-3 pl-6 pr-3">Invoice #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 pl-3 pr-6 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[#9CA3AF]">
                      No {recentFilter.toLowerCase()} invoices found today.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => onInspectInvoice(inv)}
                      className="hover:bg-[#F6F8FB] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 pl-6 pr-3 font-semibold text-[#4F46E5] tabular-nums whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-[#111827] whitespace-nowrap">
                        {inv.customerName}
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                        {formatBDT(inv.amount)}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${
                            inv.paymentStatus === 'Paid'
                              ? 'bg-[#ECFDF5] text-[#059669]'
                              : 'bg-[#FFFBEB] text-[#D97706]'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right text-[#9CA3AF] tabular-nums whitespace-nowrap">
                        {inv.time}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="xl:col-span-5 pos-card flex flex-col">
          <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">Top Selling Products</h2>
              <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">Best performers by daily revenue</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-[13px] font-medium text-[#4F46E5] hover:text-[#4338CA] whitespace-nowrap"
            >
              All products
            </button>
          </div>

          <div className="p-6 space-y-4 flex-1 flex flex-col justify-center">
            {topProducts.map((product, index) => {
              const revenue = product.soldToday * product.sellPrice;
              const pct = Math.max(Math.round((revenue / maxProductRevenue) * 100), 12);
              const barColor = index === 0 ? '#4F46E5' : index === 1 ? '#10B981' : '#6366F1';

              return (
                <div key={product.id} className="flex items-center gap-3.5">
                  <ProductThumb src={product.image} alt={product.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13.5px] font-semibold text-[#111827] truncate">
                        {product.name}
                      </p>
                      <span className="text-[13.5px] font-bold text-[#111827] tabular-nums shrink-0">
                        {formatBDT(revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <div className="flex-1 h-2 bg-[#F1F4F8] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <span className="text-[12px] text-[#9CA3AF] tabular-nums shrink-0 w-16 text-right">
                        {product.soldToday} sold
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
