import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Category, Product } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface CategoriesViewProps {
  categories: Category[];
  products: Product[];
  onAddCategory: (category: { name: string; description: string; color: string }) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  products,
  onAddCategory,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCategory({
      name: name.trim(),
      description: description.trim() || 'Retail product line',
      color,
    });
    setName('');
    setDescription('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Categories</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Organize grocery departments and monitor category revenue share
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const itemCount = products.filter((p) =>
            cat.name === 'Personal Care & Snacks'
              ? p.category === 'Personal Care' || p.category === 'Snacks & Bakery'
              : p.category === cat.name
          ).length;

          return (
            <div key={cat.id} className="pos-card p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <h2 className="text-[16px] font-semibold text-[#111827]">{cat.name}</h2>
                  </div>
                  <span className="text-[12.5px] font-semibold text-[#4B5563] tabular-nums">
                    {itemCount} SKUs
                  </span>
                </div>
                <p className="text-[13px] text-[#4B5563] mt-2 leading-relaxed">{cat.description}</p>
              </div>

              <div className="pt-3 border-t border-[#F1F4F8]">
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-[#9CA3AF]">Today&apos;s Revenue</span>
                  <span className="font-bold text-[#111827] tabular-nums">
                    {formatBDT(cat.revenueAmount)} · {cat.revenueShare}%
                  </span>
                </div>
                <div className="h-2 bg-[#F1F4F8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(cat.revenueShare, 6)}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40">
          <div className="w-full max-w-[420px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">New Category</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Spices & Condiments"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of products..."
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                  Chart Accent Color
                </label>
                <div className="flex items-center gap-2.5">
                  {['#4F46E5', '#10B981', '#F59E0B', '#0EA5E9', '#8B5CF6', '#EF4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? 'border-[#111827] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
