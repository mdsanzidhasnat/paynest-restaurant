import React, { useState } from 'react';
import {
  Package,
  Banknote,
  AlertTriangle,
  PackageX,
  PackagePlus,
  Search,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Product } from '../../types/pos';
import { formatBDT } from '../../utils/format';
import { ProductThumb } from '../common/ProductThumb';

interface InventoryViewProps {
  products: Product[];
  onRestock: (productId: string, addQty: number) => void;
  canRestock?: boolean;
}

type InventoryFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

export const InventoryView: React.FC<InventoryViewProps> = ({ products, onRestock, canRestock = true }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<string>('20');
  const [restockNotice, setRestockNotice] = useState<string | null>(null);

  const totalProducts = products.length;
  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const lowStockItems = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
  const outOfStockItems = products.filter((p) => p.stock <= 0);
  const alertItems = [...outOfStockItems, ...lowStockItems];

  const showNotice = (msg: string) => {
    setRestockNotice(msg);
    setTimeout(() => {
      setRestockNotice((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const openRestockModal = (product: Product) => {
    setRestockTarget(product);
    setRestockQty(product.stock <= 0 ? '25' : '15');
  };

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    const qty = Math.max(Number(restockQty) || 0, 1);
    onRestock(restockTarget.id, qty);
    showNotice(`Restocked +${qty} units of ${restockTarget.name}`);
    setRestockTarget(null);
  };

  const filteredProducts = products.filter((p) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'in-stock'
          ? p.stock > p.lowStockThreshold
          : filter === 'low-stock'
            ? p.stock > 0 && p.stock <= p.lowStockThreshold
            : p.stock <= 0;

    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Inventory</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Real-time stock health, reorder alerts, and shelf replenishment
          </p>
        </div>

        {restockNotice && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[13px] font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{restockNotice}</span>
          </div>
        )}
      </div>

      {/* Top Row: 4 Stat Cards (Total Products, Stock Value, Low Stock, Out of Stock) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="pos-card p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Total Products</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1.5 leading-tight">
              {totalProducts}
            </p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-2 tabular-nums">
              {products.reduce((s, p) => s + p.stock, 0).toLocaleString('en-US')} total units
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <div className="pos-card p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Stock Value</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1.5 leading-tight">
              {formatBDT(totalStockValue)}
            </p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-2">At purchase cost</p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFilter('low-stock')}
          className="pos-card p-5 flex items-start justify-between gap-4 text-left hover:border-[#F59E0B]/60 transition-colors"
        >
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Low Stock</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#D97706] tabular-nums mt-1.5 leading-tight">
              {lowStockItems.length}
            </p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-2">Below alert threshold</p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 stroke-[1.75]" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('out-of-stock')}
          className="pos-card p-5 flex items-start justify-between gap-4 text-left hover:border-[#EF4444]/60 transition-colors"
        >
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Out of Stock</p>
            <p className="text-[26px] font-bold tracking-[-0.02em] text-[#EF4444] tabular-nums mt-1.5 leading-tight">
              {outOfStockItems.length}
            </p>
            <p className="text-[12.5px] text-[#EF4444] mt-2 font-medium">
              {outOfStockItems.length > 0 ? 'Immediate reorder' : 'None depleted'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0">
            <PackageX className="w-5 h-5 stroke-[1.75]" />
          </div>
        </button>
      </div>

      {/* Highlighted "Low Stock Alerts" Card with Amber Warning Rows */}
      {alertItems.length > 0 && (
        <div className="bg-white border border-[#F59E0B]/45 rounded-[12px] shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-[#FFFBEB] border-b border-[#FDE68A] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-[15.5px] font-semibold text-[#92400E]">
                  Low Stock Alerts
                </h2>
                <p className="text-[12.5px] text-[#B45309] tabular-nums">
                  {alertItems.length} items require restocking to prevent shelf shortages
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[#FDE68A]/50">
            {alertItems.slice(0, 5).map((item) => {
              const isOut = item.stock <= 0;
              return (
                <div
                  key={item.id}
                  className="px-6 py-3.5 bg-[#FFFBEB]/45 hover:bg-[#FFFBEB]/80 flex flex-wrap items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-[220px] flex-1">
                    <ProductThumb src={item.image} alt={item.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#111827] truncate">
                        {item.name}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF] tabular-nums">
                        {item.sku} · {item.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right tabular-nums">
                      <p
                        className={`text-[13.5px] font-bold ${
                          isOut ? 'text-[#EF4444]' : 'text-[#D97706]'
                        }`}
                      >
                        {isOut ? '0 left (Out of Stock)' : `${item.stock} left`}
                      </p>
                      <p className="text-[11.5px] text-[#9CA3AF]">
                        Alert threshold: {item.lowStockThreshold}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!canRestock}
                      onClick={() => openRestockModal(item)}
                      className="h-9 px-3.5 rounded-[9px] bg-white border border-[#F59E0B]/50 hover:border-[#4F46E5] hover:text-[#4F46E5] text-[#92400E] text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Restock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock Table Below with Quantity Bars (Green / Amber / Red) and "Restock" Button */}
      <div className="pos-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6EAF0] flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full sm:w-[320px]">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inventory by name, SKU, or category..."
              className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] overflow-x-auto">
            {[
              { id: 'all' as const, label: `All (${totalProducts})` },
              {
                id: 'in-stock' as const,
                label: `In Stock (${totalProducts - alertItems.length})`,
              },
              { id: 'low-stock' as const, label: `Low Stock (${lowStockItems.length})` },
              { id: 'out-of-stock' as const, label: `Out of Stock (${outOfStockItems.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-3">Product</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3 w-[240px]">Stock Level</th>
                <th className="py-3.5 px-3 text-right">Stock Value</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#9CA3AF]">
                    No inventory items match your filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stock <= 0;
                  const isLow = p.stock > 0 && p.stock <= p.lowStockThreshold;
                  // Bar percentage relative to 60 units healthy capacity (capped 100%)
                  const capacityTarget = Math.max(p.lowStockThreshold * 3, 50);
                  const barPct = isOut ? 0 : Math.min(Math.max(Math.round((p.stock / capacityTarget) * 100), 8), 100);

                  const barColor = isOut
                    ? 'bg-[#EF4444]'
                    : isLow
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#10B981]';

                  const trackBg = isOut ? 'bg-[#FEE2E2]' : 'bg-[#F1F4F8]';

                  return (
                    <tr key={p.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 pl-6 pr-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb src={p.image} alt={p.name} size="sm" />
                          <div>
                            <p className="font-semibold text-[#111827]">{p.name}</p>
                            <p className="text-[12px] text-[#9CA3AF] tabular-nums">
                              {p.sku} · {p.unit}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-[#4B5563] whitespace-nowrap">{p.category}</td>

                      <td className="py-3.5 px-3">
                        <div className="space-y-1.5 max-w-[220px]">
                          <div className="flex items-center justify-between text-[12.5px] tabular-nums">
                            <span
                              className={`font-semibold ${
                                isOut
                                  ? 'text-[#EF4444]'
                                  : isLow
                                    ? 'text-[#D97706]'
                                    : 'text-[#111827]'
                              }`}
                            >
                              {p.stock} units
                            </span>
                            <span className="text-[#9CA3AF]">Min {p.lowStockThreshold}</span>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${trackBg}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                        {formatBDT(p.stock * p.costPrice)}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${
                            isOut
                              ? 'bg-[#FEF2F2] text-[#EF4444]'
                              : isLow
                                ? 'bg-[#FFFBEB] text-[#D97706]'
                                : 'bg-[#ECFDF5] text-[#059669]'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>

                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!canRestock}
                          onClick={() => openRestockModal(p)}
                          className="h-9 px-3.5 rounded-[9px] border border-[#E6EAF0] bg-white hover:border-[#4F46E5] hover:text-[#4F46E5] text-[#111827] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
                        >
                          <PackagePlus className="w-3.5 h-3.5 stroke-[1.75]" />
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[420px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">Restock Inventory</h3>
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close restock dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRestock} className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0]">
                <ProductThumb src={restockTarget.image} alt={restockTarget.name} size="md" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#111827] truncate">
                    {restockTarget.name}
                  </p>
                  <p className="text-[12px] text-[#4B5563] tabular-nums">
                    Current stock: <span className="font-semibold">{restockTarget.stock}</span> ·
                    Cost {formatBDT(restockTarget.costPrice)}/unit
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                  Quantity to Add
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full h-10 px-3 text-[14px] font-semibold tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
                <div className="flex items-center gap-2 mt-2.5">
                  {[10, 15, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRestockQty(String(preset))}
                      className={`px-3 py-1 rounded-[8px] text-[12px] font-semibold tabular-nums border transition-colors ${
                        restockQty === String(preset)
                          ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]'
                          : 'bg-[#F6F8FB] border-[#E6EAF0] text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-[10px] bg-[#ECFDF5]/60 border border-[#A7F3D0] text-[13px] flex items-center justify-between">
                <span className="text-[#065F46]">New Stock Level</span>
                <span className="font-bold text-[#059669] tabular-nums">
                  {restockTarget.stock + Math.max(Number(restockQty) || 0, 0)} units
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setRestockTarget(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
