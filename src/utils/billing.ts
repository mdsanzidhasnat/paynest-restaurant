export interface BillingLine {
  product: { sellPrice: number };
  quantity: number;
}

export interface BillingTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
}

export type DiscountType = 'fixed' | 'flat' | 'percentage' | 'percent';

function toFiniteNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundCurrency(value: string | number): number {
  const rounded = Math.round((toFiniteNumber(value) + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function calculateSubtotal(cart: BillingLine[]): number {
  return roundCurrency(
    cart.reduce(
      (sum, line) => sum + toFiniteNumber(line.product.sellPrice) * toFiniteNumber(line.quantity),
      0
    )
  );
}

export function calculateDiscount(
  discountInput: string | number,
  subtotal: string | number,
  discountType: DiscountType = 'fixed'
): number {
  const subtotalValue = Math.max(toFiniteNumber(subtotal), 0);
  const trimmedInput = typeof discountInput === 'string' ? discountInput.trim() : '';
  const hasPercentSuffix = trimmedInput.endsWith('%');
  const rawDiscount = toFiniteNumber(hasPercentSuffix ? trimmedInput.slice(0, -1) : discountInput);
  const isPercentage =
    discountType === 'percentage' || discountType === 'percent' || hasPercentSuffix;
  const discountValue = isPercentage ? (subtotalValue * rawDiscount) / 100 : rawDiscount;

  return roundCurrency(Math.min(Math.max(discountValue, 0), subtotalValue));
}

export function calculateTaxable(
  subtotal: string | number,
  discount: string | number
): number {
  return roundCurrency(Math.max(toFiniteNumber(subtotal) - toFiniteNumber(discount), 0));
}

export function calculateVat(taxable: string | number, vatRate: string | number): number {
  return roundCurrency((Math.max(toFiniteNumber(taxable), 0) * toFiniteNumber(vatRate)) / 100);
}

export function calculateTotal(taxable: string | number, vat: string | number): number {
  return roundCurrency(Math.max(toFiniteNumber(taxable), 0) + toFiniteNumber(vat));
}

export function calculateBilling(
  cart: BillingLine[],
  discountInput: string | number,
  vatRate: string | number,
  discountType: DiscountType = 'fixed'
): BillingTotals {
  const subtotal = calculateSubtotal(cart);
  const discount = calculateDiscount(discountInput, subtotal, discountType);
  const taxable = calculateTaxable(subtotal, discount);
  const vat = calculateVat(taxable, vatRate);
  const total = calculateTotal(taxable, vat);

  return { subtotal, discount, taxable, vat, total };
}

export function calculateDueAmount(
  total: string | number,
  paidAmount: string | number
): number {
  const payable = Math.max(toFiniteNumber(total), 0);
  const paid = Math.min(Math.max(toFiniteNumber(paidAmount), 0), payable);
  return roundCurrency(payable - paid);
}

export const getDueAmount = calculateDueAmount;
