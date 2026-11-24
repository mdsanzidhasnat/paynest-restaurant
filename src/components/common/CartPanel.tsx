import React from 'react';
import {
  Banknote,
  CreditCard,
  Minus,
  PauseCircle,
  Plus,
  Printer,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { Customer, PaymentMethod, Product } from '../../types/pos';
import { calculateBilling } from '../../utils/billing';
import { formatBDT } from '../../utils/format';

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartPanelProps {
  cart: CartLine[];
  customers: Customer[];
  selectedCustomerId: string;
  discountInput: string;
  vatRate: number;
  paymentMethod: PaymentMethod;
  panelRef?: React.Ref<HTMLDivElement>;
  onClearCart: () => void;
  onCustomerChange: (customerId: string) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveLine: (productId: string) => void;
  onDiscountChange: (value: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onPayAndPrint: () => void;
  onHoldOrder: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  customers,
  selectedCustomerId,
  discountInput,
  vatRate,
  paymentMethod,
  panelRef,
  onClearCart,
  onCustomerChange,
  onUpdateQuantity,
  onRemoveLine,
  onDiscountChange,
  onPaymentMethodChange,
  onPayAndPrint,
  onHoldOrder,
}) => {
  const { subtotal, vat, total } = calculateBilling(cart, discountInput, vatRate);
  const totalItemUnits = cart.reduce((sum, l) => sum + l.quantity, 0);

  const paymentOptions: {
    id: PaymentMethod;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'Cash', label: 'Cash', icon: Banknote },
    { id: 'bKash', label: 'bKash', icon: Smartphone },
    { id: 'Nagad', label: 'Nagad', icon: Smartphone },
    { id: 'Card', label: 'Card', icon: CreditCard },
  ];

  return (
    <div ref={panelRef} className="pos-card p-5 space-y-4 xl:sticky xl:top-[92px]">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E6EAF0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[17px] xl:text-[16px] font-bold text-[#111827]">
            Current Order
          </h2>
          <span className="px-2.5 py-0.5 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] text-[12px] font-semibold tabular-nums">
            {totalItemUnits} {totalItemUnits === 1 ? 'item' : 'items'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClearCart}
          disabled={cart.length === 0}
          className="min-h-[36px] px-2.5 rounded-lg text-[13px] font-medium text-[#EF4444] hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Stacked Tablet 2-Column Layout (< xl) -> 1-Column on xl+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5 items-start">
        {/* Left half when stacked: Customer Selector + Cart Items */}
        <div className="space-y-4">
          {/* Customer Selector */}
          <div>
            <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
              Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => onCustomerChange(e.target.value)}
              className="w-full h-11 xl:h-10 px-3 text-[14px] xl:text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
            >
              <option value="walk-in">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Cart Items List with Touch-Friendly 40-44px Steppers */}
          <div className="divide-y divide-[#F1F4F8] max-h-[280px] overflow-y-auto border-y border-[#E6EAF0]">
            {cart.length === 0 ? (
              <div className="py-10 text-center text-[13.5px] text-[#9CA3AF]">
                No items in current order. Tap &ldquo;+&rdquo; on any product to add.
              </div>
            ) : (
              cart.map((line) => (
                <div
                  key={line.product.id}
                  className="py-3 flex items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-[#111827] truncate">
                      {line.product.name}
                    </p>
                    <p className="text-[12px] text-[#9CA3AF] tabular-nums">
                      {formatBDT(line.product.sellPrice)} / unit
                    </p>
                  </div>

                  {/* Touch-Friendly Qty +/- Stepper */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(line.product.id, -1)}
                      className="w-10 h-10 xl:w-7 xl:h-7 rounded-[9px] xl:rounded-[8px] border border-[#E6EAF0] bg-[#F6F8FB] hover:bg-white active:scale-95 flex items-center justify-center text-[#4B5563]"
                      aria-label={`Decrease ${line.product.name} quantity`}
                    >
                      <Minus className="w-4 h-4 xl:w-3.5 xl:h-3.5" />
                    </button>
                    <span className="w-7 text-center text-[14px] xl:text-[13px] font-semibold text-[#111827] tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(line.product.id, 1)}
                      className="w-10 h-10 xl:w-7 xl:h-7 rounded-[9px] xl:rounded-[8px] border border-[#E6EAF0] bg-[#F6F8FB] hover:bg-white active:scale-95 flex items-center justify-center text-[#4B5563]"
                      aria-label={`Increase ${line.product.name} quantity`}
                    >
                      <Plus className="w-4 h-4 xl:w-3.5 xl:h-3.5" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="w-[64px] text-right font-semibold text-[13.5px] text-[#111827] tabular-nums shrink-0">
                    {formatBDT(line.product.sellPrice * line.quantity)}
                  </div>

                  {/* Touch-Friendly Remove Icon */}
                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.product.id)}
                    className="w-10 h-10 xl:w-8 xl:h-8 rounded-[9px] flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors shrink-0"
                    aria-label={`Remove ${line.product.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right half when stacked: Totals + Large Touch Payment Methods + Action Buttons */}
        <div className="space-y-4">
          {/* Subtotal, Discount Input, VAT 5%, Large Bold Total */}
          <div className="bg-[#F6F8FB] border border-[#E6EAF0] rounded-[12px] p-4 space-y-2.5 text-[13.5px]">
            <div className="flex items-center justify-between text-[#4B5563]">
              <span>Subtotal</span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {formatBDT(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-[#4B5563]">
              <label htmlFor="pos-discount-input">Discount (৳)</label>
              <input
                id="pos-discount-input"
                type="number"
                min="0"
                value={discountInput}
                onChange={(e) => onDiscountChange(e.target.value)}
                className="w-24 h-10 xl:h-8 px-2.5 text-right text-[14px] xl:text-[13px] font-semibold tabular-nums bg-white border border-[#E6EAF0] rounded-[8px] text-[#111827] focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            <div className="flex items-center justify-between text-[#4B5563]">
              <span>VAT ({vatRate}%)</span>
              <span className="font-medium text-[#111827] tabular-nums">{formatBDT(vat)}</span>
            </div>

            <div className="pt-2.5 border-t border-[#E6EAF0] flex items-center justify-between">
              <span className="text-[15px] font-bold text-[#111827]">Total</span>
              <span className="text-[24px] font-bold tracking-[-0.02em] text-[#4F46E5] tabular-nums">
                {formatBDT(total)}
              </span>
            </div>
          </div>

          {/* Touch-Friendly Payment Method Buttons (Cash, bKash, Nagad, Card) */}
          <div>
            <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {paymentOptions.map((opt) => {
                const Icon = opt.icon;
                const active = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onPaymentMethodChange(opt.id)}
                    className={`min-h-[56px] xl:min-h-[52px] py-2.5 px-2 rounded-[10px] border text-[13px] xl:text-[12.5px] font-semibold flex flex-col items-center justify-center gap-1 transition-colors active:scale-[0.98] ${
                      active
                        ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]'
                        : 'bg-white border-[#E6EAF0] text-[#4B5563] hover:bg-[#F6F8FB]'
                    }`}
                  >
                    <Icon className="w-5 h-5 xl:w-4 xl:h-4 stroke-[1.75]" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Large Touch-Friendly Primary & Secondary Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={onPayAndPrint}
              disabled={cart.length === 0}
              className="w-full h-14 xl:h-12 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] text-white text-[15px] xl:text-[14.5px] font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Printer className="w-5 h-5 xl:w-4 xl:h-4 stroke-[2]" />
              <span>Pay &amp; Print Invoice</span>
            </button>

            <button
              type="button"
              onClick={onHoldOrder}
              disabled={cart.length === 0}
              className="w-full h-12 xl:h-10 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] active:scale-[0.99] text-[#111827] text-[14px] xl:text-[13.5px] font-medium inline-flex items-center justify-center gap-2 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <PauseCircle className="w-4 h-4 text-[#4B5563] stroke-[1.75]" />
              <span>Hold Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
