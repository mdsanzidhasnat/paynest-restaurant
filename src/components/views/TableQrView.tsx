import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, ApiError } from '../../api/client';
import { RestaurantTable, TableQr } from '../../types/pos';

interface TableQrViewProps {
  canRotate: boolean;
}

export function TableQrView({ canRotate }: TableQrViewProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [qr, setQr] = useState<TableQr | null>(null);
  const [error, setError] = useState('');
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await api.getTables();
        if (cancelled) return;
        setTables(rows);
        setSelectedId((current) => current || rows[0]?.id || '');
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'Unable to load tables.');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function loadQr() {
      try {
        const result = await api.getTableQr(selectedId);
        if (!cancelled) {
          setQr(result);
          setError('');
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'Unable to load the QR code.');
        }
      }
    }
    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function rotate() {
    if (!selectedId || rotating) return;
    setRotating(true);
    try {
      const result = await api.rotateTableQr(selectedId);
      setQr(result);
      setError('');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to rotate the QR code.');
    } finally {
      setRotating(false);
    }
  }

  function print() {
    document.body.classList.add('qr-print-mode');
    window.print();
    window.setTimeout(() => document.body.classList.remove('qr-print-mode'), 0);
  }

  const qrValue = qr ? `${window.location.origin}${qr.url}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Table QR codes</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Print a code for each table. Guests scan it to open the menu without logging in.
        </p>
      </div>

      {error && (
        <div className="rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-[13px] font-medium text-[#92400E]">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="pos-card p-4 no-print">
          <h2 className="mb-3 text-[13px] font-semibold text-[#374151]">Tables</h2>
          {tables.length === 0 ? (
            <p className="text-[13px] text-[#6B7280]">No tables have been created yet.</p>
          ) : (
            <div className="max-h-[520px] space-y-1 overflow-y-auto">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedId(table.id)}
                  className={`flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[13px] transition-colors ${
                    selectedId === table.id
                      ? 'bg-[#EEF2FF] font-semibold text-[#4338CA]'
                      : 'text-[#374151] hover:bg-[#F6F8FB]'
                  }`}
                >
                  <span>Table {table.number}</span>
                  <span className="text-[11px] text-[#9CA3AF]">{table.floorName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pos-card p-6 text-center">
          {qr ? (
            <>
              <div className="text-[12px] font-medium uppercase tracking-wide text-[#6B7280]">
                {qr.tableNumber ? `Table ${qr.tableNumber}` : 'Table'}
              </div>
              <div className="mx-auto mt-4 flex w-fit flex-col items-center rounded-[12px] border border-[#E6EAF0] bg-white p-5">
                <QRCodeSVG value={qrValue} size={220} level="M" includeMargin />
                <div className="mt-3 text-[15px] font-bold text-[#111827]">Table {qr.tableNumber}</div>
                <div className="mt-1 text-[11px] text-[#9CA3AF]">Scan to view the menu</div>
              </div>
              <p className="mt-4 break-all text-[11px] text-[#9CA3AF]">{qrValue}</p>
              <p className="mt-2 text-[12px] text-[#6B7280]">
                Token version {qr.version}. Rotating invalidates every previously printed code.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 no-print">
                <button
                  type="button"
                  onClick={print}
                  className="rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA]"
                >
                  Print QR code
                </button>
                {canRotate && (
                  <button
                    type="button"
                    onClick={() => void rotate()}
                    disabled={rotating}
                    className="rounded-[9px] border border-[#D1D5DB] px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F6F8FB] disabled:opacity-60"
                  >
                    {rotating ? 'Rotating…' : 'Rotate token'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="py-16 text-[13px] text-[#6B7280]">Select a table to see its QR code.</p>
          )}
        </div>
      </div>
    </div>
  );
}
