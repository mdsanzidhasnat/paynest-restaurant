import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableCard } from './TableCard';
import type { RestaurantTable, TableStatus } from '../../types/pos';

function table(status: TableStatus): RestaurantTable {
  return {
    id: 'tbl-1',
    floorId: 'flr-1',
    floorName: 'Ground floor',
    number: '12',
    seats: 4,
    x: 10,
    y: 20,
    shape: 'round',
    status,
    qrSecretVersion: 1,
  };
}

function renderCard(status: TableStatus, canTransfer = false) {
  const onOpen = vi.fn();
  const onTransfer = vi.fn();
  render(
    <TableCard
      table={table(status)}
      canTransfer={canTransfer}
      onOpen={onOpen}
      onTransfer={onTransfer}
    />
  );
  return { onOpen, onTransfer };
}

describe('TableCard', () => {
  it('renders a free table with its status and open action', () => {
    const { onOpen } = renderCard('free');

    expect(screen.getByText('Table 12')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open table 12' })).toBeInTheDocument();
    expect(screen.queryByText('View order')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Open table 12' }).click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders an occupied table with the view and transfer actions', () => {
    const { onTransfer } = renderCard('occupied', true);

    expect(screen.getByText('Occupied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View order for table 12' })).toBeInTheDocument();

    const transfer = screen.getByRole('button', { name: 'Transfer table 12' });
    transfer.click();
    expect(onTransfer).toHaveBeenCalledOnce();
  });

  it('renders a bill-pending table and hides transfer when not permitted', () => {
    renderCard('bill_pending', false);

    expect(screen.getByText('Bill pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer table 12' })).not.toBeInTheDocument();
  });
});
