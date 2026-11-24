import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, Product } from '../../types/pos';
import { CartLine, CartPanel } from './CartPanel';

const firstProduct: Product = {
  id: 'prod-1',
  sku: 'PN-1001',
  name: 'Test Product',
  category: 'Grocery Staples',
  unit: '1 kg Pack',
  costPrice: 60,
  sellPrice: 100,
  stock: 10,
  lowStockThreshold: 2,
  soldToday: 0,
  soldThisWeek: 0,
};

const secondProduct: Product = {
  ...firstProduct,
  id: 'prod-2',
  sku: 'PN-1002',
  name: 'Another Product',
  sellPrice: 50,
};

const cart: CartLine[] = [
  { product: firstProduct, quantity: 2 },
  { product: secondProduct, quantity: 1 },
];

const customers: Customer[] = [];

function renderCartPanel(discountInput = '0') {
  return render(
    <CartPanel
      cart={cart}
      customers={customers}
      selectedCustomerId="walk-in"
      discountInput={discountInput}
      vatRate={10}
      paymentMethod="Cash"
      onClearCart={vi.fn()}
      onCustomerChange={vi.fn()}
      onUpdateQuantity={vi.fn()}
      onRemoveLine={vi.fn()}
      onDiscountChange={vi.fn()}
      onPaymentMethodChange={vi.fn()}
      onPayAndPrint={vi.fn()}
      onHoldOrder={vi.fn()}
    />
  );
}

function expectRowValue(label: string, value: string) {
  const row = screen.getByText(label).parentElement;
  expect(row).not.toBeNull();
  expect(within(row!).getByText(value)).toBeInTheDocument();
}

describe('CartPanel', () => {
  it('renders billing totals from the cart', () => {
    renderCartPanel();

    expectRowValue('Subtotal', '৳250');
    expectRowValue('VAT (10%)', '৳25');
    expectRowValue('Total', '৳275');
  });

  it('applies the discount before showing VAT and total', () => {
    renderCartPanel('50');

    expectRowValue('Subtotal', '৳250');
    expectRowValue('VAT (10%)', '৳20');
    expectRowValue('Total', '৳220');
  });
});
