import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api, ApiError, type AuthUser } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { StatusBadge } from '../common/StatusBadge';
import type { RestaurantRole } from '../../types/domain';

const ROLES: { value: RestaurantRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'waiter', label: 'Waiter' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'cashier', label: 'Cashier' },
];

const ROLE_TONES: Record<RestaurantRole, string> = {
  admin: 'bg-[#EEF2FF] text-[#4F46E5]',
  manager: 'bg-[#ECFDF5] text-[#047857]',
  waiter: 'bg-[#F0F9FF] text-[#0284C7]',
  kitchen: 'bg-[#FEF2F2] text-[#B91C1C]',
  cashier: 'bg-[#FFFBEB] text-[#92400E]',
};

interface UserForm {
  name: string;
  email: string;
  phone: string;
  role: RestaurantRole;
  password: string;
  active: boolean;
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  phone: '',
  role: 'cashier',
  password: '',
  active: true,
};

function toRole(role: string): RestaurantRole {
  const lower = role.trim().toLowerCase();
  return ROLES.find((entry) => entry.value === lower)?.value ?? 'cashier';
}

export function UsersView() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await api.getUsers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load staff users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setNotice('');
    setFormOpen(true);
  }

  function openEdit(user: AuthUser) {
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: toRole(user.role),
      password: '',
      active: user.active,
    });
    setNotice('');
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Enter a name and email address.');
      return;
    }
    if (!editingId && form.password.length < 8) {
      setError('New accounts need a password of at least 8 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingId) {
        await api.updateUser(editingId, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        setNotice('Staff account updated.');
      } else {
        await api.createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          active: form.active,
          password: form.password,
        });
        setNotice('Staff account created.');
      }
      setFormOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save the staff account.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(user: AuthUser) {
    setBusy(true);
    setError('');
    try {
      await api.toggleUser(user.id);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to change that account.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('Staff account removed.');
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to remove that account.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading staff users…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Users</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Staff accounts and the five restaurant roles.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA]"
        >
          <Plus className="h-4 w-4" /> Add user
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {notice && (
        <p className="rounded-[10px] border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[13px] font-medium text-[#047857]">
          {notice}
        </p>
      )}

      {users.length === 0 ? (
        <EmptyState title="No staff users" description="Add an account to get started." />
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-[#E6EAF0] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Phone</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8]">
              {users.map((user) => {
                const role = toRole(user.role);
                return (
                  <tr key={user.id} className="hover:bg-[#F6F8FB]">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#111827]">{user.name}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{user.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-[8px] px-2.5 py-0.5 text-[12px] font-semibold ${ROLE_TONES[role]}`}
                      >
                        {role === 'admin' && <ShieldCheck className="h-3.5 w-3.5" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#4B5563]">{user.phone || '—'}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggle(user)}
                        aria-label={`${user.active ? 'Deactivate' : 'Activate'} ${user.name}`}
                        className="disabled:opacity-50"
                      >
                        <StatusBadge status={user.active ? 'available' : 'unavailable'} />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          aria-label={`Edit ${user.name}`}
                          className="rounded-[8px] p-2 text-[#4B5563] hover:bg-[#EEF2FF] hover:text-[#4F46E5]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          aria-label={`Delete ${user.name}`}
                          className="rounded-[8px] p-2 text-[#4B5563] hover:bg-[#FEF2F2] hover:text-[#EF4444]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 p-4">
          <div className="w-full max-w-[440px] rounded-[12px] border border-[#E6EAF0] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E6EAF0] px-6 py-4">
              <h2 className="text-[16px] font-semibold text-[#111827]">
                {editingId ? 'Edit staff user' : 'Add user'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block text-[12px] font-medium text-[#4B5563]">
                Full name
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
                />
              </label>
              <label className="block text-[12px] font-medium text-[#4B5563]">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[12px] font-medium text-[#4B5563]">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
                  />
                </label>
                <label className="block text-[12px] font-medium text-[#4B5563]">
                  Role
                  <select
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value as RestaurantRole })}
                    className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-[12px] font-medium text-[#4B5563]">
                {editingId ? 'New password (leave blank to keep)' : 'Password'}
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder={editingId ? 'Optional' : 'At least 8 characters'}
                  className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px] text-[#111827]"
                />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#374151]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  className="h-4 w-4 accent-[#4F46E5]"
                />
                Account active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-[9px] border border-[#E6EAF0] px-4 py-2 text-[13px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
                  className="rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save user'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 p-4">
          <div className="w-full max-w-[400px] space-y-4 rounded-[12px] border border-[#E6EAF0] bg-white p-6 shadow-xl">
            <h2 className="text-[16px] font-semibold text-[#111827]">Remove staff user</h2>
            <p className="text-[13px] text-[#4B5563]">
              Remove <span className="font-semibold">{deleteTarget.name}</span> from restaurant access?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-[9px] border border-[#E6EAF0] px-4 py-2 text-[13px] font-medium text-[#4B5563]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="rounded-[9px] bg-[#EF4444] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#DC2626] disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
