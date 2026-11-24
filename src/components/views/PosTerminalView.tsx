import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  PauseCircle,
  CheckCircle2,
  Package,
  RotateCcw,
  ShoppingCart,
  ArrowDown,
  X,
} from 'lucide-react';
import { Customer, PaymentMethod, Product } from '../../types/pos';
import { formatBDT } from '../../utils/format';
import { calculateBilling } from '../../utils/billing';
import { BarcodeInput, findProductByScanCode } from '../common/BarcodeInput';
import { CartLine, CartPanel } from '../common/CartPanel';

interface HeldOrder {
  id: string;
  customerId: string;
  customerName: string;
  items: CartLine[];
  discount: string;
  heldAt: string;
}

interface PosTerminalViewProps {
  products: Product[];
  customers: Customer[];
  vatPercent: number;
  onCompleteSale: (payload: {
    customerId: string;
    customerName: string;
    items: CartLine[];
    discount: number;
    vat: number;
    paymentMethod: PaymentMethod;
  }) => void;
  liveScanQuery?: string;
  pendingBarcodeScan?: {
    id: number;
    code: string;
  } | null;
}

type PosFilterChip = 'All' | 'Grocery' | 'Beverage' | 'Snacks' | 'Personal Care' | 'Dairy';

const POS_CATEGORY_CHIPS: PosFilterChip[] = [
  'All',
  'Grocery',
  'Beverage',
  'Snacks',
  'Personal Care',
  'Dairy',
];

function matchesPosChip(product: Product, chip: PosFilterChip): boolean {
  if (chip === 'All') return true;
  if (chip === 'Grocery') {
    return (
      product.category === 'Rice & Grains' ||
      product.category === 'Cooking Oil' ||
      product.category === 'Grocery Staples'
    );
  }
  if (chip === 'Dairy') {
    return product.name.toLowerCase().includes('milk') && product.category === 'Dairy & Beverages';
  }
  if (chip === 'Beverage') {
    return (
      product.category === 'Dairy & Beverages' && !product.name.toLowerCase().includes('milk')
    );
  }
  if (chip === 'Snacks') {
    return product.category === 'Snacks & Bakery';
  }
  if (chip === 'Personal Care') {
    return product.category === 'Personal Care';
  }
  return true;
}

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  products,
  customers,
  vatPercent,
  onCompleteSale,
  liveScanQuery = '',
  pendingBarcodeScan = null,
}) => {
  const [search, setSearch] = useState('');
  const [selectedChip, setSelectedChip] = useState<PosFilterChip>('All');
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const cartPanelRef = useRef<HTMLDivElement>(null);
  const lastHandledScanIdRef = useRef<number | null>(null);

  const [cart, setCart] = useState<CartLine[]>(() => {
    const initial: CartLine[] = [];
    if (products[0]) initial.push({ product: products[0], quantity: 1 });
    if (products[1]) initial.push({ product: products[1], quantity: 1 });
    if (products[3]) initial.push({ product: products[3], quantity: 2 });
    return initial;
  });

  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldDrawer, setShowHeldDrawer] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'walk-in');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Sync live global scanner prefix input into search for instant visual filtering
  useEffect(() => {
    if (liveScanQuery) {
      setSelectedChip('All');
    }
  }, [liveScanQuery]);

  // Consume completed global barcode scan and add product to cart without manual clicking
  useEffect(() => {
    if (!pendingBarcodeScan || pendingBarcodeScan.id === lastHandledScanIdRef.current) return;
    lastHandledScanIdRef.current = pendingBarcodeScan.id;

    const matched = findProductByScanCode(products, pendingBarcodeScan.code);
    if (!matched) {
      showToast(`No product found for barcode "${pendingBarcodeScan.code}"`);
      return;
    }
    if (matched.stock <= 0) {
      showToast(`${matched.name} is out of stock`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === matched.id);
      if (existing) {
        if (existing.quantity >= matched.stock) return prev;
        return prev.map((line) =>
          line.product.id === matched.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [...prev, { product: matched, quantity: 1 }];
    });
    setSearch('');
    showToast(`Scanned ${matched.sku}: Added ${matched.name}`);
  }, [pendingBarcodeScan, products]);

  const effectiveSearch = (liveScanQuery || search).trim().toLowerCase();

  const filteredProducts = products.filter((p) => {
    const matchesCat = matchesPosChip(p, selectedChip);
    const matchesQuery =
      !effectiveSearch ||
      p.name.toLowerCase().includes(effectiveSearch) ||
      p.sku.toLowerCase().includes(effectiveSearch) ||
      (p.barcode && p.barcode.toLowerCase().includes(effectiveSearch));
    return matchesCat && matchesQuery;
  });

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.product.id !== productId) return line;
          const nextQty = line.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > line.product.stock) return line;
          return { ...line, quantity: nextQty };
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((line) => line.product.id !== productId));
  };

  const effectiveVatRate = vatPercent > 0 ? vatPercent : 5;
  const { discount, vat, total } = calculateBilling(cart, discountInput, effectiveVatRate);
  const totalItemUnits = cart.reduce((sum, l) => sum + l.quantity, 0);

  const handlePayAndPrint = () => {
    if (cart.length === 0) return;
    const customer = customers.find((c) => c.id === selectedCustomerId);
    onCompleteSale({
      customerId: customer ? customer.id : 'walk-in',
      customerName: customer ? customer.name : 'Walk-in Customer',
      items: cart,
      discount,
      vat,
      paymentMethod,
    });
    setCart([]);
    setDiscountInput('0');
    showToast('Invoice generated and payment recorded.');
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const heldTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const newHeld: HeldOrder = {
      id: `hold-${Date.now()}`,
      customerId: selectedCustomerId,
      customerName: customer ? customer.name : 'Walk-in Customer',
      items: cart,
      discount: discountInput,
      heldAt: heldTime,
    };
    setHeldOrders((prev) => [newHeld, ...prev]);
    setCart([]);
    setDiscountInput('0');
    showToast('Order placed on hold.');
  };

  const handleResumeHeldOrder = (order: HeldOrder) => {
    setCart(order.items);
    setSelectedCustomerId(order.customerId);
    setDiscountInput(order.discount);
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
    setShowHeldDrawer(false);
    showToast(`Resumed order for ${order.customerName}`);
  };

  const scrollToCartPanel = () => {
    cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-4">
      {/* Compact POS Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">
            New Sale (POS)
          </h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Fast billing register · Tap products or scan barcode to build invoice
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {toastMessage && (
            <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[13px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {heldOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldDrawer((prev) => !prev)}
              className="h-11 px-4 rounded-[10px] border border-[#F59E0B]/40 bg-[#FFFBEB] text-[#B45309] text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <PauseCircle className="w-4 h-4" />
              Held Orders ({heldOrders.length})
            </button>
          )}

          {/* Quick Jump to Stacked Cart on Tablet/Mobile (< xl) */}
          <button
            type="button"
            onClick={scrollToCartPanel}
            className="xl:hidden h-11 px-4 rounded-[10px] bg-[#EEF2FF] border border-[#4F46E5]/30 text-[#4F46E5] text-[13.5px] font-semibold inline-flex items-center gap-2.5 transition-colors whitespace-nowrap"
          >
            <ShoppingCart className="w-4 h-4 stroke-[2]" />
            <span className="tabular-nums">
              Order ({totalItemUnits}) · {formatBDT(total)}
            </span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Held Orders Recall Strip */}
      {showHeldDrawer && heldOrders.length > 0 && (
        <div className="pos-card p-4 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-[#4B5563] mr-1">
            Resume Held Order:
          </span>
          {heldOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => handleResumeHeldOrder(order)}
              className="min-h-[42px] px-3.5 py-2 rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] hover:border-[#4F46E5] hover:bg-[#EEF2FF] text-[13px] font-medium text-[#111827] inline-flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-[#4F46E5]" />
              <span>{order.customerName}</span>
              <span className="text-[#9CA3AF] tabular-nums">
                ({order.items.reduce((s, i) => s + i.quantity, 0)} items · {order.heldAt})
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowHeldDrawer(false)}
            className="ml-auto p-2 text-[#9CA3AF] hover:text-[#111827]"
            aria-label="Close held orders bar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Responsive Split: Stacked cleanly on 1024x768 tablet (< xl), 65/35 side-by-side on wide desktop (xl+) */}
      <div className="grid grid-cols-1 xl:grid-cols-[65fr_35fr] gap-5 items-start">
        {/* PRODUCT CATALOG SECTION */}
        <div className="space-y-4 min-w-0">
          {/* Touch-Friendly Search + Barcode Scan + Category Filter Chips */}
          <div className="pos-card p-4 space-y-3.5">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
                <input
                  type="text"
                  value={liveScanQuery || search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && search.trim()) {
                      const exactMatch = products.find(
                        (p) =>
                          p.sku.toLowerCase() === search.trim().toLowerCase() ||
                          p.barcode?.toLowerCase() === search.trim().toLowerCase()
                      );
                      if (exactMatch) {
                        addToCart(exactMatch);
                        setSearch('');
                        showToast(`Added ${exactMatch.name}`);
                      }
                    }
                  }}
                  placeholder="Search or scan barcode anytime (e.g. PN-1001, Rice, Oil)..."
                  className="w-full h-12 xl:h-10 pl-10 pr-4 text-[14px] xl:text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                />
              </div>

              <button
                type="button"
                onClick={() => setBarcodeOpen((prev) => !prev)}
                className={`h-12 xl:h-10 px-5 xl:px-4 rounded-[10px] border text-[14px] xl:text-[13.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                  barcodeOpen
                    ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]'
                    : 'bg-white border-[#E6EAF0] text-[#111827] hover:bg-[#F6F8FB]'
                }`}
              >
                <ScanBarcode className="w-5 h-5 xl:w-4 xl:h-4 stroke-[1.75]" />
                <span>Scan Barcode</span>
              </button>
            </div>

            {/* Inline Barcode Scanner Bar */}
            <BarcodeInput
              open={barcodeOpen}
              products={products}
              onAddProduct={addToCart}
              onToast={showToast}
            />

            {/* Touch-Friendly Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {POS_CATEGORY_CHIPS.map((chip) => {
                const active = selectedChip === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelectedChip(chip)}
                    className={`min-h-[44px] xl:min-h-[36px] px-4 xl:px-3.5 py-2 xl:py-1.5 rounded-[10px] text-[13.5px] xl:text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#4F46E5] text-white shadow-xs'
                        : 'bg-[#F6F8FB] text-[#4B5563] border border-[#E6EAF0] hover:text-[#111827] hover:bg-white'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Cards Grid: 4 cols on 1024px tablet full-width, 3-4 cols on wide desktop */}
          {filteredProducts.length === 0 ? (
            <div className="pos-card p-12 text-center">
              <p className="text-[14px] font-medium text-[#4B5563]">
                No products match &ldquo;{search}&rdquo; in {selectedChip}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedChip('All');
                }}
                className="mt-3 min-h-[44px] px-5 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4F46E5] hover:bg-[#EEF2FF]"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
              {filteredProducts.map((product) => {
                const isOut = product.stock <= 0;
                const isLow = product.stock > 0 && product.stock <= product.lowStockThreshold;
                const cartQty = cart.find((c) => c.product.id === product.id)?.quantity || 0;
                const imgFailed = failedImages[product.id];

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOut && addToCart(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isOut) {
                        e.preventDefault();
                        addToCart(product);
                      }
                    }}
                    className={`pos-card p-3 flex flex-col justify-between gap-2.5 transition-all select-none ${
                      isOut
                        ? 'opacity-55 cursor-not-allowed'
                        : 'cursor-pointer hover:border-[#4F46E5] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]'
                    } ${cartQty > 0 ? 'ring-1 ring-[#4F46E5]/30 border-[#4F46E5]/60' : ''}`}
                  >
                    {/* Product Image + Stock Badge */}
                    <div className="relative w-full aspect-[4/3] rounded-[9px] bg-[#F8FAFC] border border-[#E6EAF0] overflow-hidden flex items-center justify-center">
                      {product.image && !imgFailed ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[#9CA3AF] gap-1">
                          <Package className="w-7 h-7 stroke-[1.5]" />
                          <span className="text-[11px] font-medium tabular-nums">{product.sku}</span>
                        </div>
                      )}

                      {/* Stock Badge */}
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold tabular-nums shadow-2xs ${
                          isOut
                            ? 'bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]'
                            : isLow
                              ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                              : 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                        }`}
                      >
                        {isOut ? 'Out' : `${product.stock} in stock`}
                      </span>

                      {cartQty > 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[6px] bg-[#4F46E5] text-white text-[11px] font-semibold tabular-nums">
                          ×{cartQty}
                        </span>
                      )}
                    </div>

                    {/* Product Name & Unit */}
                    <div className="min-w-0">
                      <h3 className="text-[13.5px] font-semibold text-[#111827] leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">
                        {product.unit} · {product.sku}
                      </p>
                    </div>

                    {/* Price & Touch-Friendly 44px "+" Add Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F4F8]">
                      <span className="text-[16px] font-bold text-[#111827] tabular-nums">
                        {formatBDT(product.sellPrice)}
                      </span>
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        aria-label={`Add ${product.name} to order`}
                        className="w-11 h-11 xl:w-9 xl:h-9 rounded-[10px] bg-[#EEF2FF] hover:bg-[#4F46E5] active:scale-95 text-[#4F46E5] hover:text-white flex items-center justify-center transition-all disabled:opacity-40"
                      >
                        <Plus className="w-5 h-5 xl:w-4 xl:h-4 stroke-[2.25]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CART PANEL: Stacked 2-column checkout block on 1024x768 tablet (< xl), Right 35% sticky column on desktop (xl+) */}
        <CartPanel
          cart={cart}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          discountInput={discountInput}
          vatRate={effectiveVatRate}
          paymentMethod={paymentMethod}
          panelRef={cartPanelRef}
          onClearCart={() => setCart([])}
          onCustomerChange={setSelectedCustomerId}
          onUpdateQuantity={updateQty}
          onRemoveLine={removeLine}
          onDiscountChange={setDiscountInput}
          onPaymentMethodChange={setPaymentMethod}
          onPayAndPrint={handlePayAndPrint}
          onHoldOrder={handleHoldOrder}
        />
      </div>
    </div>
  );
};
