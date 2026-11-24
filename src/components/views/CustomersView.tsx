import React, { useState } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  X,
  Users,
  AlertCircle,
  UserPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Customer } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface CustomersViewProps {
  customers: Customer[];
  onAddCustomer: (customer: { name: string; phone: string; email: string; area: string }) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onCollectDue: (customerId: string) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}

const AVATAR_TONES = [
  'bg-[#EEF2FF] text-[#4F46E5]',
  'bg-[#ECFDF5] text-[#059669]',
  'bg-[#F0F9FF] text-[#0284C7]',
  'bg-[#FFFBEB] text-[#D97706]',
  'bg-[#F5F3FF] text-[#7C3AED]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onCollectDue,
  canWrite = true,
  canDelete = true,
}) => {
  const [search, setSearch] = useState('');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'settled'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const totalCustomersCount = customers.length;
  const totalDueAmount = customers.reduce((sum, c) => sum + c.dueBalance, 0);
  const dueCustomerCount = customers.filter((c) => c.dueBalance > 0).length;
  const newThisMonthCount = customers.filter((c) => c.isNewThisMonth).length;

  const filtered = customers.filter((c) => {
    const matchFilter =
      dueFilter === 'all'
        ? true
        : dueFilter === 'due'
          ? c.dueBalance > 0
          : c.dueBalance === 0;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setArea('');
    setModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setEmail(cust.email);
    setArea(cust.area);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const cleanEmail =
      email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@gmail.com`;

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        area: area.trim() || editingCustomer.area,
      });
      showToast(`Updated ${name.trim()}`);
    } else {
      onAddCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        area: area.trim() || 'Dhaka',
      });
      showToast(`Added customer ${name.trim()}`);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header with "Add Customer" button at top right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Customers</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Customer directory, purchase totals &amp; receivable due tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          {toast && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[12.5px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              {toast}
            </span>
          )}
          <button
            type="button"
            disabled={!canWrite}
            onClick={openAddModal}
            className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Top Mini Stat Cards: Total Customers, Total Due, New This Month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="pos-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Total Customers</p>
            <p className="text-[24px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1">
              {totalCustomersCount}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">Registered store accounts</p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <div className="pos-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">Total Due</p>
            <p
              className={`text-[24px] font-bold tracking-[-0.02em] tabular-nums mt-1 ${
                totalDueAmount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
              }`}
            >
              {formatBDT(totalDueAmount)}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1 tabular-nums">
              {dueCustomerCount > 0
                ? `Across ${dueCustomerCount} customers`
                : 'All balances settled'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        <div className="pos-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#4B5563]">New This Month</p>
            <p className="text-[24px] font-bold tracking-[-0.02em] text-[#111827] tabular-nums mt-1">
              {newThisMonthCount}
            </p>
            <p className="text-[12px] font-medium text-[#10B981] mt-1">Joined in Nov 2026</p>
          </div>
          <div className="w-11 h-11 rounded-[10px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="pos-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[380px]">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px]">
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'due' as const, label: `With Due (${dueCustomerCount})` },
            { id: 'settled' as const, label: 'Settled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDueFilter(tab.id)}
              className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                dueFilter === tab.id
                  ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Data Table */}
      <div className="pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                <th className="py-3.5 pl-6 pr-2 w-[56px]">Avatar</th>
                <th className="py-3.5 px-3">Name</th>
                <th className="py-3.5 px-3">Phone</th>
                <th className="py-3.5 px-3">Email</th>
                <th className="py-3.5 px-3 text-right">Total Purchase</th>
                <th className="py-3.5 px-3 text-right">Due Amount</th>
                <th className="py-3.5 px-3 text-right">Last Order Date</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#9CA3AF]">
                    No customers match your search or filter.
                  </td>
                </tr>
              ) : (
                filtered.map((cust, index) => {
                  const toneClass = AVATAR_TONES[index % AVATAR_TONES.length];
                  const hasDue = cust.dueBalance > 0;

                  return (
                    <tr key={cust.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 pl-6 pr-2">
                        <div
                          className={`w-9 h-9 rounded-full font-semibold text-[12.5px] flex items-center justify-center border border-[#E6EAF0] ${toneClass}`}
                        >
                          {getInitials(cust.name)}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-semibold text-[#111827] whitespace-nowrap">{cust.name}</p>
                        <p className="text-[12px] text-[#9CA3AF] whitespace-nowrap">{cust.area}</p>
                      </td>
                      <td className="py-3.5 px-3 text-[#4B5563] tabular-nums whitespace-nowrap">
                        {cust.phone}
                      </td>
                      <td className="py-3.5 px-3 text-[#4B5563] whitespace-nowrap">{cust.email}</td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-[#111827] tabular-nums">
                          {formatBDT(cust.totalSpent)}
                        </span>
                        <span className="block text-[11.5px] text-[#9CA3AF] tabular-nums">
                          {cust.totalOrders} orders
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {hasDue ? (
                          <span className="font-bold text-[#EF4444]">
                            {formatBDT(cust.dueBalance)}
                          </span>
                        ) : (
                          <span className="text-[#10B981] font-medium">৳0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right text-[#4B5563] tabular-nums whitespace-nowrap">
                        {cust.lastOrderDate}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {hasDue && (
                            <button
                              type="button"
                              onClick={() => {
                                onCollectDue(cust.id);
                                showToast(`Collected due for ${cust.name}`);
                              }}
                              className="px-2.5 py-1.5 rounded-[8px] bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] text-[12px] font-semibold inline-flex items-center gap-1 transition-colors mr-1"
                              title="Mark due as collected"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Collect
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => openEditModal(cust)}
                            className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
                            aria-label={`Edit ${cust.name}`}
                            title="Edit customer"
                          >
                            <Pencil className="w-4 h-4 stroke-[1.75]" />
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => setConfirmDelete(cust)}
                            className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                            aria-label={`Delete ${cust.name}`}
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4 stroke-[1.75]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[440px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Full Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Tanvir Ahmed"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Phone Number <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="000-000-0000"
                  className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Area / Address
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Dhanmondi, Dhaka"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium"
                >
                  {editingCustomer ? 'Save Changes' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[400px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold text-[#111827]">Delete Customer</h3>
            <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
              Remove <span className="font-semibold text-[#111827]">{confirmDelete.name}</span> from
              your customer directory?
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canDelete}
                onClick={() => {
                  onDeleteCustomer(confirmDelete.id);
                  showToast(`Removed ${confirmDelete.name}`);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 rounded-[10px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13.5px] font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
