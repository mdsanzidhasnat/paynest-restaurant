import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { TableCard } from '../common/TableCard';
import type { RestaurantFloor, RestaurantOrder, RestaurantTable } from '../../types/domain';

interface TablesViewProps {
  canTransfer: boolean;
  onOpenOrder: (order: RestaurantOrder) => void;
}

export function TablesView({ canTransfer, onOpenOrder }: TablesViewProps) {
  const [floors, setFloors] = useState<RestaurantFloor[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [transferTable, setTransferTable] = useState<RestaurantTable | null>(null);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [floorRows, orderRows] = await Promise.all([api.getTableMap(), api.getOrders()]);
      setFloors(floorRows);
      setOrders(orderRows);
      setActiveFloorId((current) => current || floorRows[0]?.id || '');
    } catch {
      setError('Unable to load the floor map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openOrders = useMemo(
    () => orders.filter((order) => order.paymentStatus === 'unpaid' && order.status !== 'closed'),
    [orders]
  );
  const currentFloor = floors.find((floor) => floor.id === activeFloorId) ?? floors[0];
  const freeTables = floors.flatMap((floor) => floor.tables).filter((table) => table.status === 'free');

  async function handleOpen(table: RestaurantTable) {
    if (busy) return;
    const existing = openOrders.find((order) => order.tableId === table.id);
    if (existing) {
      onOpenOrder(existing);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api.createOrder({ tableId: table.id });
      setOrders((previous) => [created, ...previous]);
      onOpenOrder(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open the table.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer() {
    if (!transferTable || !destination || busy) return;
    setBusy(true);
    setError('');
    try {
      const order = openOrders.find((entry) => entry.tableId === transferTable.id);
      if (order) await api.transferOrder(order.id, destination);
      setTransferTable(null);
      setDestination('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to transfer the order.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading tables…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Tables</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Open a table to start an order, or transfer an existing one.
        </p>
      </div>

      {error && <ErrorState message={error} />}

      {floors.length === 0 ? (
        <EmptyState title="No floors yet" description="Add a floor before creating tables." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => setActiveFloorId(floor.id)}
                className={`rounded-[9px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                  floor.id === currentFloor?.id
                    ? 'bg-[#4F46E5] text-white'
                    : 'border border-[#E6EAF0] bg-white text-[#4B5563] hover:bg-[#F6F8FB]'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>

          {currentFloor && currentFloor.tables.length === 0 ? (
            <EmptyState title="No tables on this floor" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {currentFloor?.tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  canTransfer={canTransfer}
                  onOpen={(target) => void handleOpen(target)}
                  onTransfer={(target) => {
                    setTransferTable(target);
                    setDestination('');
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {transferTable && (
        <div className="rounded-[12px] border border-[#C7D2FE] bg-white p-5 shadow-sm">
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Transfer Table {transferTable.number}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className="h-10 min-w-[220px] rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            >
              <option value="">Choose a free table</option>
              {freeTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.floorName} — Table {table.number}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleTransfer()}
              disabled={!destination || busy}
              className="rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
            >
              Transfer order
            </button>
            <button
              type="button"
              onClick={() => setTransferTable(null)}
              className="rounded-[9px] border border-[#E6EAF0] px-4 py-2 text-[13px] font-medium text-[#4B5563]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
