import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Barcode,
  ImagePlus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Category, Product } from '../../types/pos';
import { PRODUCT_IMAGES } from '../../data/productImages';
import { formatBDT } from '../../utils/format';

interface AddProductViewProps {
  categories: Category[];
  existingCount: number;
  editingProduct?: Product | null;
  onCancel: () => void;
  onSave: (
    payload: Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>,
    editingId?: string
  ) => void;
}

const SAMPLE_PRESET_IMAGES = [
  { label: 'Biryani', url: PRODUCT_IMAGES.biryani },
  { label: 'Tehari', url: PRODUCT_IMAGES.tehari },
  { label: 'Khichuri', url: PRODUCT_IMAGES.khichuri },
  { label: 'Naan', url: PRODUCT_IMAGES.naan },
  { label: 'Chai', url: PRODUCT_IMAGES.chai },
  { label: 'Dessert', url: PRODUCT_IMAGES.dessert },
];

export const AddProductView: React.FC<AddProductViewProps> = ({
  categories,
  existingCount,
  editingProduct,
  onCancel,
  onSave,
}) => {
  const isEditing = Boolean(editingProduct);

  const [name, setName] = useState(editingProduct?.name || '');
  const [sku, setSku] = useState(editingProduct?.sku || `PN-${1001 + existingCount}`);
  const [barcode, setBarcode] = useState(
    editingProduct?.barcode || `8941100${String(1001 + existingCount).slice(-4)}21`
  );
  const [category, setCategory] = useState(
    editingProduct?.category || categories[0]?.name || 'Grocery Staples'
  );
  const [brand, setBrand] = useState(editingProduct?.brand || '');
  const [unit, setUnit] = useState(editingProduct?.unit || '1 kg Pack');
  const [purchasePrice, setPurchasePrice] = useState(
    editingProduct ? String(editingProduct.costPrice) : ''
  );
  const [sellingPrice, setSellingPrice] = useState(
    editingProduct ? String(editingProduct.sellPrice) : ''
  );
  const [stockQuantity, setStockQuantity] = useState(
    editingProduct ? String(editingProduct.stock) : '25'
  );
  const [alertQuantity, setAlertQuantity] = useState(
    editingProduct ? String(editingProduct.lowStockThreshold) : '10'
  );
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [imagePreview, setImagePreview] = useState<string>(editingProduct?.image || '');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryChoices = Array.from(
    new Set([
      ...categories.map((c) => c.name),
      'Rice & Grains',
      'Cooking Oil',
      'Grocery Staples',
      'Dairy & Beverages',
      'Snacks & Bakery',
      'Personal Care',
    ])
  );

  const unitChoices = [
    '1 kg Pack',
    '2 kg Pack',
    '5 kg Bag',
    '1 Ltr Bottle',
    '2 Ltr Bottle',
    '5 Ltr Bottle',
    '1 Ltr Carton',
    '180 g Pack',
    '200 g Pack',
    '400 g Pack',
    '100 g Bar',
    'Bundle',
    'Piece',
  ];

  const handleGenerateSku = () => {
    const rand = Math.floor(1000 + Math.random() * 8999);
    setSku(`PN-${rand}`);
    setBarcode(`8941100${rand}09`);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, or WebP).');
      return;
    }
    setErrorMsg(null);
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = '';
  };

  const parsedCost = Number(purchasePrice) || 0;
  const parsedSell = Number(sellingPrice) || 0;
  const profitPerUnit = parsedSell - parsedCost;
  const marginPct = parsedSell > 0 ? ((profitPerUnit / parsedSell) * 100).toFixed(1) : '0.0';

  const parsedStock = Math.max(Number(stockQuantity) || 0, 0);
  const parsedAlert = Math.max(Number(alertQuantity) || 0, 1);
  const computedStatus =
    parsedStock <= 0 ? 'Out of Stock' : parsedStock <= parsedAlert ? 'Low Stock' : 'In Stock';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }
    if (!sku.trim()) {
      setErrorMsg('SKU is required.');
      return;
    }
    if (parsedSell <= 0) {
      setErrorMsg('Selling price must be greater than ৳0.');
      return;
    }

    setErrorMsg(null);
    onSave(
      {
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        name: name.trim(),
        category,
        brand: brand.trim() || undefined,
        unit: unit.trim() || 'Piece',
        costPrice: parsedCost > 0 ? parsedCost : Math.round(parsedSell * 0.85),
        sellPrice: parsedSell,
        stock: parsedStock,
        lowStockThreshold: parsedAlert,
        description: description.trim() || undefined,
        image: imagePreview || undefined,
      },
      editingProduct?.id
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-[calc(100vh-136px)]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="w-10 h-10 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#4B5563] flex items-center justify-center transition-colors"
            aria-label="Back to Products"
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[12.5px] text-[#9CA3AF]">
              <button
                type="button"
                onClick={onCancel}
                className="hover:text-[#4F46E5] transition-colors"
              >
                Products
              </button>
              <span aria-hidden="true">/</span>
              <span className="text-[#4B5563] font-medium">
                {isEditing ? 'Edit Product' : 'Add Product'}
              </span>
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827] mt-0.5">
              {isEditing ? `Edit ${editingProduct?.name}` : 'Add New Product'}
            </h1>
          </div>
        </div>

        {errorMsg && (
          <div className="px-3.5 py-2 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] text-[13px] font-medium">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Two-Column White Cards Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 pb-8">
        {/* Left Column (8 cols): Product Details + Pricing & Inventory */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Basic Information */}
          <div className="pos-card p-6 space-y-5">
            <div className="pb-3 border-b border-[#F1F4F8]">
              <h2 className="text-[16px] font-semibold text-[#111827]">Product Details</h2>
              <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                Core item identifiers, brand, and catalog classification
              </p>
            </div>

            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <label
                  htmlFor="add-prod-name"
                  className="block text-[13px] font-medium text-[#111827] mb-1.5"
                >
                  Product Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="add-prod-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rupchanda Fortified Soyabean Oil 5L"
                  className="w-full h-10 px-3.5 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="add-prod-sku"
                      className="text-[13px] font-medium text-[#111827]"
                    >
                      SKU <span className="text-[#EF4444]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="text-[12px] font-medium text-[#4F46E5] hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Auto-generate
                    </button>
                  </div>
                  <input
                    id="add-prod-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="PN-1017"
                    className="w-full h-10 px-3.5 text-[13.5px] tabular-nums bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-prod-barcode"
                    className="block text-[13px] font-medium text-[#111827] mb-1.5"
                  >
                    Barcode (EAN-13 / UPC)
                  </label>
                  <div className="relative">
                    <Barcode className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="add-prod-barcode"
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="8941100101721"
                      className="w-full h-10 pl-10 pr-3.5 text-[13.5px] tabular-nums bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                    />
                  </div>
                </div>
              </div>

              {/* Category, Brand, Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="add-prod-category"
                    className="block text-[13px] font-medium text-[#111827] mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="add-prod-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                  >
                    {categoryChoices.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="add-prod-brand"
                    className="block text-[13px] font-medium text-[#111827] mb-1.5"
                  >
                    Brand
                  </label>
                  <input
                    id="add-prod-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Rupchanda, Fresh, ACI"
                    className="w-full h-10 px-3.5 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-prod-unit"
                    className="block text-[13px] font-medium text-[#111827] mb-1.5"
                  >
                    Unit
                  </label>
                  <select
                    id="add-prod-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full h-10 px-3 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                  >
                    {unitChoices.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="add-prod-desc"
                  className="block text-[13px] font-medium text-[#111827] mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="add-prod-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional shelf notes, packaging details, or supplier batch info..."
                  className="w-full p-3.5 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Pricing & Stock */}
          <div className="pos-card p-6 space-y-5">
            <div className="pb-3 border-b border-[#F1F4F8] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-semibold text-[#111827]">Pricing &amp; Inventory</h2>
                <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                  Configure purchase cost, retail price in BDT (৳), and low-stock alert threshold
                </p>
              </div>
              {parsedSell > 0 && (
                <div className="text-[12.5px] font-medium text-[#4B5563] tabular-nums">
                  Est. Margin:{' '}
                  <span
                    className={`font-semibold ${
                      profitPerUnit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {formatBDT(profitPerUnit)} ({marginPct}%)
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="add-prod-cost"
                  className="block text-[13px] font-medium text-[#111827] mb-1.5"
                >
                  Purchase Price (৳)
                </label>
                <input
                  id="add-prod-cost"
                  type="number"
                  min="0"
                  step="1"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="365"
                  className="w-full h-10 px-3.5 text-[13.5px] tabular-nums bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                />
              </div>

              <div>
                <label
                  htmlFor="add-prod-sell"
                  className="block text-[13px] font-medium text-[#111827] mb-1.5"
                >
                  Selling Price (৳) <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="add-prod-sell"
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="420"
                  className="w-full h-10 px-3.5 text-[13.5px] font-semibold tabular-nums bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                />
              </div>

              <div>
                <label
                  htmlFor="add-prod-stock"
                  className="block text-[13px] font-medium text-[#111827] mb-1.5"
                >
                  Stock Quantity
                </label>
                <input
                  id="add-prod-stock"
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full h-10 px-3.5 text-[13.5px] tabular-nums bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                />
              </div>

              <div>
                <label
                  htmlFor="add-prod-alert"
                  className="block text-[13px] font-medium text-[#111827] mb-1.5"
                >
                  Alert Quantity
                </label>
                <input
                  id="add-prod-alert"
                  type="number"
                  min="1"
                  value={alertQuantity}
                  onChange={(e) => setAlertQuantity(e.target.value)}
                  className="w-full h-10 px-3.5 text-[13.5px] tabular-nums bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Drag-and-Drop Image Upload + Live Preview */}
        <div className="lg:col-span-4 space-y-6">
          <div className="pos-card p-6 space-y-4">
            <div className="pb-3 border-b border-[#F1F4F8]">
              <h2 className="text-[16px] font-semibold text-[#111827]">Product Image</h2>
              <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                Shown on POS quick-billing cards and product catalog
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {imagePreview ? (
              <div className="space-y-3">
                <div className="relative aspect-square w-full rounded-[12px] border border-[#E6EAF0] bg-[#F8FAFC] overflow-hidden">
                  <img
                    src={imagePreview}
                    alt={name || 'Product preview'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#4B5563] truncate">
                    {imageFileName || 'Selected product thumbnail'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-[8px] border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] text-[12px] font-medium text-[#111827]"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('');
                        setImageFileName('');
                      }}
                      className="p-1.5 rounded-[8px] border border-[#E6EAF0] text-[#EF4444] hover:bg-[#FEF2F2]"
                      aria-label="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`aspect-square w-full rounded-[12px] border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#4F46E5] bg-[#EEF2FF]'
                    : 'border-[#D1D5DB] bg-[#F6F8FB] hover:border-[#4F46E5] hover:bg-[#EEF2FF]/40'
                }`}
              >
                <div className="w-12 h-12 rounded-[12px] bg-white border border-[#E6EAF0] text-[#4F46E5] flex items-center justify-center mb-3 shadow-2xs">
                  <UploadCloud className="w-6 h-6 stroke-[1.75]" />
                </div>
                <p className="text-[14px] font-semibold text-[#111827]">
                  Drag &amp; drop image here
                </p>
                <p className="text-[12.5px] text-[#4B5563] mt-1">
                  or <span className="text-[#4F46E5] font-medium underline">browse files</span>
                </p>
                <p className="text-[11.5px] text-[#9CA3AF] mt-3">
                  PNG, JPG, or WebP · Recommended 800×800px
                </p>
              </div>
            )}

            {/* Quick Studio Asset Picker */}
            <div className="pt-2 border-t border-[#F1F4F8]">
              <p className="text-[12px] font-medium text-[#4B5563] mb-2 flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5 text-[#9CA3AF]" />
                Quick studio presets
              </p>
              <div className="grid grid-cols-6 gap-2">
                {SAMPLE_PRESET_IMAGES.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setImagePreview(preset.url);
                      setImageFileName(`${preset.label} preset`);
                    }}
                    title={`Use ${preset.label} image`}
                    className={`aspect-square rounded-[8px] overflow-hidden border transition-all ${
                      imagePreview === preset.url
                        ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20'
                        : 'border-[#E6EAF0] hover:border-[#4F46E5]'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Catalog Summary Card */}
          <div className="pos-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#111827]">Catalog Preview</span>
              <span
                className={`px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${
                  computedStatus === 'In Stock'
                    ? 'bg-[#ECFDF5] text-[#059669]'
                    : computedStatus === 'Low Stock'
                      ? 'bg-[#FFFBEB] text-[#D97706]'
                      : 'bg-[#FEF2F2] text-[#EF4444]'
                }`}
              >
                {computedStatus}
              </span>
            </div>
            <div className="text-[13px] text-[#4B5563] space-y-1.5">
              <div className="flex justify-between">
                <span>SKU</span>
                <span className="font-medium text-[#111827] tabular-nums">{sku || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Selling Price</span>
                <span className="font-semibold text-[#111827] tabular-nums">
                  {parsedSell > 0 ? formatBDT(parsedSell) : '৳0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Opening Stock</span>
                <span className="font-medium text-[#111827] tabular-nums">
                  {parsedStock} ({unit})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar with Cancel and Save Product */}
      <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-[2px] border-t border-[#E6EAF0] px-6 lg:px-8 py-4 -mx-6 lg:-mx-8 mt-auto flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13px] text-[#4B5563]">
          {isEditing
            ? 'Editing catalog item · Changes apply immediately to POS & Inventory'
            : 'Ready to publish to PayNest Mart catalog & POS counter'}
        </p>

        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-5 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F9FAFB] text-[#111827] text-[13.5px] font-medium transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-10 px-5 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
          >
            <Save className="w-4 h-4 stroke-[1.75]" />
            <span>{isEditing ? 'Update Product' : 'Save Product'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
