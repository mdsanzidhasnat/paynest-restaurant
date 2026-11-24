import React, { useRef, useState } from 'react';
import {
  Plus,
  Search,
  Upload,
  Download,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Category, Product } from '../../types/pos';
import { getStockStatus, ProductTable } from '../common/ProductTable';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts: (items: Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>[]) => void;
  onOpenAddProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}

type StockStatusFilter = 'All' | 'In Stock' | 'Low Stock' | 'Out of Stock';

const PAGE_SIZE = 8;

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onImportProducts,
  onOpenAddProduct,
  onOpenEditProduct,
  canWrite = true,
  canDelete = true,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('All');
  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for Add / Edit
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Grocery Staples');
  const [unit, setUnit] = useState('1 kg Pack');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('25');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const categoryOptions = [
    'All',
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const filtered = products.filter((p) => {
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    const status = getStockStatus(p);
    const matchStatus = statusFilter === 'All' || status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchCat && matchStatus && matchQ;
  });

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedProducts = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setSku(`PN-${1001 + products.length}`);
    setCategory(categoryOptions[1] || 'Grocery Staples');
    setUnit('1 kg Pack');
    setCostPrice('');
    setSellPrice('');
    setStock('25');
    setLowStockThreshold('10');
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setCategory(product.category);
    setUnit(product.unit);
    setCostPrice(product.costPrice.toString());
    setSellPrice(product.sellPrice.toString());
    setStock(product.stock.toString());
    setLowStockThreshold(product.lowStockThreshold.toString());
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sellPrice) return;

    const parsedSell = Math.max(Number(sellPrice) || 0, 1);
    const parsedCost = Number(costPrice) || Math.round(parsedSell * 0.85);
    const parsedStock = Math.max(Number(stock) || 0, 0);
    const parsedThreshold = Math.max(Number(lowStockThreshold) || 10, 1);

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        sku: sku.trim() || editingProduct.sku,
        name: name.trim(),
        category,
        unit: unit.trim() || editingProduct.unit,
        costPrice: parsedCost,
        sellPrice: parsedSell,
        stock: parsedStock,
        lowStockThreshold: parsedThreshold,
      });
      showToast(`Updated ${name.trim()}`);
    } else {
      onAddProduct({
        sku: sku.trim() || `PN-${1001 + products.length}`,
        name: name.trim(),
        category,
        unit: unit.trim() || '1 pc',
        costPrice: parsedCost,
        sellPrice: parsedSell,
        stock: parsedStock,
        lowStockThreshold: parsedThreshold,
      });
      showToast(`Added ${name.trim()} to catalog`);
    }

    setModalOpen(false);
  };

  const handleExportCSV = () => {
    const rows = [
      ['SKU', 'Product Name', 'Unit', 'Category', 'Purchase Price (BDT)', 'Selling Price (BDT)', 'Stock', 'Status'],
      ...filtered.map((p) => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.unit}"`,
        `"${p.category}"`,
        p.costPrice.toString(),
        p.sellPrice.toString(),
        p.stock.toString(),
        getStockStatus(p),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'paynest-products-catalog.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filtered.length} products to CSV`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length <= 1) {
        showToast('CSV file is empty or missing product rows');
        return;
      }
      const parsedItems: Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2 && cols[1]) {
          parsedItems.push({
            sku: cols[0] || `PN-${1100 + i}`,
            name: cols[1],
            unit: cols[2] || '1 pc',
            category: cols[3] || 'Grocery Staples',
            costPrice: Number(cols[4]) || 100,
            sellPrice: Number(cols[5]) || 120,
            stock: Number(cols[6]) || 20,
            lowStockThreshold: 10,
          });
        }
      }
      if (parsedItems.length > 0) {
        onImportProducts(parsedItems);
        setCurrentPage(1);
        showToast(`Imported ${parsedItems.length} products`);
      } else {
        showToast('No valid rows found in CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* Header Row: Title, Import/Export buttons, Add Product primary button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Products</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5 tabular-nums">
            {products.length} total SKUs · Manage purchase costs, selling prices &amp; stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {toast && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[12.5px] font-medium mr-1">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              {toast}
            </span>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            disabled={!canWrite}
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#111827] text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-[#4B5563] stroke-[1.75]" />
            Import
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-10 px-4 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#111827] text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#4B5563] stroke-[1.75]" />
            Export
          </button>

          <button
            type="button"
            disabled={!canWrite}
            onClick={onOpenAddProduct}
            className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filter Row: Search, Category Dropdown, Stock Status Dropdown */}
      <div className="pos-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by product name or SKU..."
            className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="prod-cat-select" className="text-[12.5px] font-medium text-[#4B5563] whitespace-nowrap">
              Category
            </label>
            <select
              id="prod-cat-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="prod-status-select" className="text-[12.5px] font-medium text-[#4B5563] whitespace-nowrap">
              Stock Status
            </label>
            <select
              id="prod-status-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StockStatusFilter);
                setCurrentPage(1);
              }}
              className="h-10 px-3 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
            >
              <option value="All">All Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table Card */}
      <ProductTable
        products={paginatedProducts}
        totalCount={filtered.length}
        startIndex={startIdx}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        safePage={safePage}
        totalPages={totalPages}
        canWrite={canWrite}
        canDelete={canDelete}
        onOpenEditProduct={onOpenEditProduct}
        onRequestDelete={setConfirmDelete}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Radhuni Turmeric Powder 200g"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="PN-1017"
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="200 g Pack"
                    className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] bg-white focus:outline-none focus:border-[#4F46E5]"
                >
                  {Array.from(
                    new Set([
                      ...categories.map((c) => c.name),
                      'Grocery Staples',
                      'Rice & Grains',
                      'Cooking Oil',
                      'Dairy & Beverages',
                      'Snacks & Bakery',
                      'Personal Care',
                    ])
                  ).map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Purchase (৳)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Selling (৳)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Alert At
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
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
                  {editingProduct ? 'Save Changes' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[400px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold text-[#111827]">Delete Product</h3>
            <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-[#111827]">{confirmDelete.name}</span> (
              {confirmDelete.sku}) from the product catalog?
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canDelete}
                onClick={() => {
                  onDeleteProduct(confirmDelete.id);
                  showToast(`Deleted ${confirmDelete.name}`);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 rounded-[10px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13.5px] font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
