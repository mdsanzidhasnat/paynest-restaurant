import React from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Product } from '../../types/pos';
import { formatBDT } from '../../utils/format';
import { ProductThumb } from './ProductThumb';

interface ProductTableProps {
  products: Product[];
  totalCount: number;
  startIndex: number;
  pageSize: number;
  currentPage: number;
  safePage: number;
  totalPages: number;
  canWrite?: boolean;
  canDelete?: boolean;
  onOpenEditProduct: (product: Product) => void;
  onRequestDelete: (product: Product) => void;
  onPageChange: (page: number) => void;
}

export function getStockStatus(p: Product): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (p.stock <= 0) return 'Out of Stock';
  if (p.stock <= p.lowStockThreshold) return 'Low Stock';
  return 'In Stock';
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  totalCount,
  startIndex,
  pageSize,
  currentPage,
  safePage,
  totalPages,
  canWrite = true,
  canDelete = true,
  onOpenEditProduct,
  onRequestDelete,
  onPageChange,
}) => (
  <div className="pos-card overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
            <th className="py-3.5 pl-6 pr-3 w-[64px]">Image</th>
            <th className="py-3.5 px-3">Product Name</th>
            <th className="py-3.5 px-3">SKU</th>
            <th className="py-3.5 px-3">Category</th>
            <th className="py-3.5 px-3 text-right">Purchase Price</th>
            <th className="py-3.5 px-3 text-right">Selling Price</th>
            <th className="py-3.5 px-3 text-right">Stock Qty</th>
            <th className="py-3.5 px-3">Status</th>
            <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
          {products.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center text-[#9CA3AF]">
                No products match your search or selected filters.
              </td>
            </tr>
          ) : (
            products.map((p) => {
              const status = getStockStatus(p);
              const badgeStyle =
                status === 'In Stock'
                  ? 'bg-[#ECFDF5] text-[#059669]'
                  : status === 'Low Stock'
                    ? 'bg-[#FFFBEB] text-[#D97706]'
                    : 'bg-[#FEF2F2] text-[#EF4444]';

              return (
                <tr key={p.id} className="hover:bg-[#F6F8FB] transition-colors">
                  <td className="py-3 pl-6 pr-3">
                    <ProductThumb src={p.image} alt={p.name} size="md" />
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-[#111827]">{p.name}</p>
                    <p className="text-[12px] text-[#9CA3AF]">{p.unit}</p>
                  </td>
                  <td className="py-3 px-3 text-[#4B5563] tabular-nums whitespace-nowrap">
                    {p.sku}
                  </td>
                  <td className="py-3 px-3 text-[#4B5563] whitespace-nowrap">{p.category}</td>
                  <td className="py-3 px-3 text-right text-[#4B5563] tabular-nums whitespace-nowrap">
                    {formatBDT(p.costPrice)}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                    {formatBDT(p.sellPrice)}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                    {p.stock}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${badgeStyle}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => onOpenEditProduct(p)}
                        className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
                        aria-label={`Edit ${p.name}`}
                        title="Edit product"
                      >
                        <Pencil className="w-4 h-4 stroke-[1.75]" />
                      </button>
                      <button
                        type="button"
                        disabled={!canDelete}
                        onClick={() => onRequestDelete(p)}
                        className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                        aria-label={`Delete ${p.name}`}
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4 stroke-[1.75]" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    {/* Pagination Footer */}
    <div className="px-6 py-4 border-t border-[#E6EAF0] bg-[#FAFBFD] flex flex-wrap items-center justify-between gap-4 text-[13px]">
      <p className="text-[#4B5563] tabular-nums">
        Showing{' '}
        <span className="font-semibold text-[#111827]">
          {totalCount === 0 ? 0 : startIndex + 1}
        </span>
        –
        <span className="font-semibold text-[#111827]">
          {Math.min(startIndex + pageSize, totalCount)}
        </span>{' '}
        of <span className="font-semibold text-[#111827]">{totalCount}</span> products
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          className="h-9 px-3 rounded-[9px] border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] text-[#4B5563] font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {Array.from({ length: totalPages }).map((_, idx) => {
          const pageNum = idx + 1;
          const isCurrent = pageNum === safePage;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`w-9 h-9 rounded-[9px] text-[13px] font-semibold tabular-nums transition-colors ${
                isCurrent
                  ? 'bg-[#4F46E5] text-white'
                  : 'border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] text-[#4B5563]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          className="h-9 px-3 rounded-[9px] border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] text-[#4B5563] font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);
