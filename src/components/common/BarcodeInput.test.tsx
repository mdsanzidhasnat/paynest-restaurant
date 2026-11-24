import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types/pos';
import { BarcodeInput } from './BarcodeInput';

const product: Product = {
  id: 'prod-1',
  sku: 'PN-1001',
  barcode: '1001001',
  name: 'Test Product',
  category: 'Grocery Staples',
  unit: '1 kg Pack',
  costPrice: 80,
  sellPrice: 100,
  stock: 10,
  lowStockThreshold: 2,
  soldToday: 0,
  soldThisWeek: 0,
};

function BarcodeHarness({ onAddProduct }: { onAddProduct: (product: Product) => void }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <BarcodeInput open products={[product]} onAddProduct={onAddProduct} onToast={setMessage} />
      {message && <div role="status">{message}</div>}
    </>
  );
}

describe('BarcodeInput', () => {
  it('adds a matching product when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onAddProduct = vi.fn();
    render(<BarcodeHarness onAddProduct={onAddProduct} />);

    const input = screen.getByPlaceholderText(/Enter or scan SKU barcode/);
    await user.type(input, 'PN-1001{enter}');

    expect(onAddProduct).toHaveBeenCalledWith(product);
    expect(screen.getByText('Scanned: Test Product')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('shows an error toast for an unknown barcode', async () => {
    const user = userEvent.setup();
    const onAddProduct = vi.fn();
    render(<BarcodeHarness onAddProduct={onAddProduct} />);

    await user.type(screen.getByPlaceholderText(/Enter or scan SKU barcode/), 'UNKNOWN{enter}');

    expect(onAddProduct).not.toHaveBeenCalled();
    expect(screen.getByText('No product found for code "UNKNOWN"')).toBeInTheDocument();
  });
});
