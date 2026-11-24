import React, { useEffect, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { Product } from '../../types/pos';

interface BarcodeInputProps {
  open: boolean;
  products: Product[];
  onAddProduct: (product: Product) => void;
  onToast: (message: string) => void;
}

const QUICK_TEST_SKUS = ['PN-1001', 'PN-1003', 'PN-1005'];

export function findProductByScanCode(
  products: Product[],
  rawCode: string
): Product | undefined {
  const code = rawCode.trim().toLowerCase();
  if (!code) return undefined;
  return (
    products.find((p) => p.barcode?.toLowerCase() === code) ||
    products.find((p) => p.sku.toLowerCase() === code) ||
    products.find((p) => p.sku.toLowerCase().startsWith(code)) ||
    products.find((p) => p.name.toLowerCase().includes(code))
  );
}

export const BarcodeInput: React.FC<BarcodeInputProps> = ({
  open,
  products,
  onAddProduct,
  onToast,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const match = findProductByScanCode(products, code);
    if (match) {
      onAddProduct(match);
      onToast(`Scanned: ${match.name}`);
      setBarcodeInput('');
    } else {
      onToast(`No product found for code "${barcodeInput.trim()}"`);
    }
  };

  if (!open) return null;

  return (
    <form
      onSubmit={handleBarcodeSubmit}
      className="flex flex-wrap items-center gap-2.5 p-3 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0]"
    >
      <ScanBarcode className="w-4 h-4 text-[#4F46E5] shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={barcodeInput}
        onChange={(e) => setBarcodeInput(e.target.value)}
        placeholder="Enter or scan SKU barcode (e.g. PN-1001) and press Enter..."
        className="flex-1 min-w-[200px] h-11 xl:h-9 px-3 text-[13.5px] bg-white border border-[#E6EAF0] rounded-[8px] focus:outline-none focus:border-[#4F46E5]"
      />
      <button
        type="submit"
        className="h-11 xl:h-9 px-4 rounded-[8px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium whitespace-nowrap"
      >
        Add SKU
      </button>
      <div className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
        <span>Quick test:</span>
        {QUICK_TEST_SKUS.map((sku) => (
          <button
            key={sku}
            type="button"
            onClick={() => {
              const found = products.find((p) => p.sku === sku);
              if (found) {
                onAddProduct(found);
                onToast(`Scanned ${found.sku}: ${found.name}`);
              }
            }}
            className="min-h-[36px] px-2.5 py-1 rounded-md bg-white border border-[#E6EAF0] text-[#4B5563] hover:text-[#4F46E5] hover:border-[#4F46E5] font-medium tabular-nums"
          >
            {sku}
          </button>
        ))}
      </div>
    </form>
  );
};
