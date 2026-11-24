import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Save } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { ErrorState, LoadingState } from '../common/AsyncState';
import { Notice } from '../common/Notice';
import type { RestaurantSettings } from '../../types/domain';

interface SettingsViewProps {
  onSaved?: (settings: RestaurantSettings) => void;
}

export function SettingsView({ onSaved }: SettingsViewProps) {
  const [form, setForm] = useState<RestaurantSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setForm(await api.getSettings());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof RestaurantSettings>(key: K, value: RestaurantSettings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!form || busy) return;
    if (!form.restaurantName.trim() || !form.currencySymbol.trim() || !form.invoicePrefix.trim()) {
      setError('Restaurant name, currency symbol and invoice prefix are required.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await api.updateSettings(form);
      setForm(saved);
      setNotice('Settings saved.');
      onSaved?.(saved);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading settings…" />;
  if (!form) return <ErrorState message={error || 'No settings available.'} onRetry={() => void load()} />;

  const number = (key: 'vatPercent' | 'serviceChargePercent' | 'lowStockDefault') => ({
    type: 'number' as const,
    min: 0,
    step: key === 'lowStockDefault' ? '1' : '0.5',
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      update(key, Number(event.target.value) || 0),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Settings</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Restaurant profile, billing rules and guest ordering preferences.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {notice && (
        <Notice tone="green" className="px-4 py-2.5">
          {notice}
        </Notice>
      )}

      <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-6">
        <h2 className="text-[15px] font-semibold text-[#111827]">Restaurant profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Restaurant name
            <input
              value={form.restaurantName}
              onChange={(event) => update('restaurantName', event.target.value)}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Phone
            <input
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Address
            <input
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-6">
        <h2 className="text-[15px] font-semibold text-[#111827]">Billing and stock</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Currency symbol
            <input
              value={form.currencySymbol}
              onChange={(event) => update('currencySymbol', event.target.value)}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Invoice prefix
            <input
              value={form.invoicePrefix}
              onChange={(event) => update('invoicePrefix', event.target.value)}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            VAT (%)
            <input {...number('vatPercent')} max={100} className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]" />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Service charge (%)
            <input {...number('serviceChargePercent')} max={100} className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]" />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Default low-stock threshold
            <input {...number('lowStockDefault')} className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]" />
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563]">
            Paper size
            <select
              value={form.paperSize}
              onChange={(event) => update('paperSize', event.target.value as 'A4' | '80mm')}
              className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
            >
              <option value="A4">A4</option>
              <option value="80mm">80mm receipt</option>
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4B5563] sm:col-span-2">
            Receipt footer
            <textarea
              rows={2}
              value={form.receiptFooter}
              onChange={(event) => update('receiptFooter', event.target.value)}
              className="mt-1 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 py-2 text-[13px] text-[#111827]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-6">
        <h2 className="text-[15px] font-semibold text-[#111827]">Guest ordering</h2>
        <label className="mt-4 flex items-center justify-between gap-4 rounded-[10px] border border-[#E6EAF0] bg-[#F6F8FB] p-4">
          <span>
            <span className="block text-[13px] font-medium text-[#111827]">
              Auto-confirm QR orders
            </span>
            <span className="mt-0.5 block text-[12px] text-[#6B7280]">
              When off, a waiter must confirm guest orders before the kitchen sees them.
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.autoConfirmPublicOrders}
            onChange={(event) => update('autoConfirmPublicOrders', event.target.checked)}
            className="h-4 w-4 accent-[#4F46E5]"
          />
        </label>
        <p className="mt-3 text-[11px] text-[#9CA3AF]">
          Printed QR tokens expire according to the server&apos;s QR_TOKEN_TTL_SECONDS setting.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[9px] bg-[#4F46E5] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
