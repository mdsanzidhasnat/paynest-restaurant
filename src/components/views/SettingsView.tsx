import React, { useState } from 'react';
import {
  Store,
  Users,
  Percent,
  FileText,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Save,
  X,
  ShieldCheck,
} from 'lucide-react';
import { StaffRole, StaffUser, StoreSettings } from '../../types/pos';

interface SettingsViewProps {
  settings: StoreSettings;
  onSaveSettings: (updated: StoreSettings) => void;
  staffUsers: StaffUser[];
  onAddUser: (user: Omit<StaffUser, 'id' | 'lastActive'>) => void;
  onUpdateUser: (user: StaffUser) => void;
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  canManageUsers?: boolean;
}

type SettingsTab =
  | 'shop-profile'
  | 'users-roles'
  | 'tax-currency'
  | 'invoice-settings'
  | 'payment-methods';

const SETTINGS_TABS: {
  id: SettingsTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'shop-profile',
    label: 'Shop Profile',
    description: 'Store details & address',
    icon: Store,
  },
  {
    id: 'users-roles',
    label: 'Users & Roles',
    description: 'Staff access & permissions',
    icon: Users,
  },
  {
    id: 'tax-currency',
    label: 'Tax & Currency',
    description: 'VAT rate & currency symbol',
    icon: Percent,
  },
  {
    id: 'invoice-settings',
    label: 'Invoice Settings',
    description: 'Receipt layout & footer',
    icon: FileText,
  },
  {
    id: 'payment-methods',
    label: 'Payment Methods',
    description: 'Cash, mobile banking & card',
    icon: CreditCard,
  },
];

const AVATAR_TONES = [
  'bg-[#EEF2FF] text-[#4F46E5]',
  'bg-[#ECFDF5] text-[#059669]',
  'bg-[#FFFBEB] text-[#D97706]',
  'bg-[#F0F9FF] text-[#0284C7]',
  'bg-[#F5F3FF] text-[#7C3AED]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function getRoleBadgeClass(role: StaffRole): string {
  switch (role) {
    case 'Admin':
      return 'bg-[#EEF2FF] text-[#4F46E5]';
    case 'Manager':
      return 'bg-[#ECFDF5] text-[#059669]';
    case 'Cashier':
      return 'bg-[#FFFBEB] text-[#D97706]';
    case 'Waiter':
      return 'bg-[#F0F9FF] text-[#0284C7]';
    case 'Kitchen':
      return 'bg-[#FEF2F2] text-[#DC2626]';
  }
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  staffUsers,
  onAddUser,
  onUpdateUser,
  onToggleUserStatus,
  onDeleteUser,
  canManageUsers = true,
}) => {
  // Default to Users & Roles tab as requested
  const [activeTab, setActiveTab] = useState<SettingsTab>(canManageUsers ? 'users-roles' : 'shop-profile');
  const [form, setForm] = useState<StoreSettings>(settings);
  const [toast, setToast] = useState<string | null>(null);
  const visibleTabs = canManageUsers
    ? SETTINGS_TABS
    : SETTINGS_TABS.filter((tab) => tab.id !== 'users-roles');

  // Add / Edit User modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRole, setUserRole] = useState<StaffRole>('Cashier');
  const [userActive, setUserActive] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    showToast('Settings saved successfully');
  };

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPhone('');
    setUserRole('Cashier');
    setUserActive(true);
    setUserModalOpen(true);
  };

  const openEditUserModal = (user: StaffUser) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPhone(user.phone);
    setUserRole(user.role);
    setUserActive(user.active);
    setUserModalOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        name: userName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim() || editingUser.phone,
        role: userRole,
        active: userActive,
      });
      showToast(`Updated ${userName.trim()}`);
    } else {
      onAddUser({
        name: userName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim() || '000-000-0000',
        role: userRole,
        active: userActive,
      });
      showToast(`Added ${userName.trim()} as ${userRole}`);
    }
    setUserModalOpen(false);
  };

  const pm = form.paymentMethods ?? {
    cash: true,
    bkash: true,
    nagad: true,
    card: true,
    due: true,
    bkashNumber: '000-000-0000',
    nagadNumber: '000-000-0000',
  };

  const activeStaffCount = staffUsers.filter((u) => u.active).length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Settings</h1>
          <p className="text-[13.5px] text-[#4B5563] mt-0.5">
            Manage store configuration, staff permissions, tax rules, and billing preferences
          </p>
        </div>

        {toast && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[13px] font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            {toast}
          </span>
        )}
      </div>

      {/* Two-Column Settings Layout: Left Tabs + Right Content Card */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left Tabs Navigation Card */}
        <nav className="pos-card p-2.5 space-y-1" aria-label="Settings sections">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[10px] text-left transition-colors ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#4F46E5]'
                    : 'text-[#4B5563] hover:bg-[#F6F8FB] hover:text-[#111827]'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 stroke-[1.75] ${
                    isActive ? 'text-[#4F46E5]' : 'text-[#9CA3AF]'
                  }`}
                />
                <div className="min-w-0">
                  <p
                    className={`text-[13.5px] leading-tight truncate ${
                      isActive ? 'font-semibold text-[#4F46E5]' : 'font-medium text-[#111827]'
                    }`}
                  >
                    {tab.label}
                  </p>
                  <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">{tab.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right Tab Content Panel */}
        <div className="min-w-0">
          {/* TAB 1: SHOP PROFILE */}
          {activeTab === 'shop-profile' && (
            <form onSubmit={handleSaveForm} className="pos-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6EAF0]">
                <h2 className="text-[16px] font-semibold text-[#111827]">Shop Profile</h2>
                <p className="text-[13px] text-[#4B5563] mt-0.5">
                  Store name, branch details, and contact info printed on customer receipts
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Shop / Store Name
                    </label>
                    <input
                      type="text"
                      value={form.storeName}
                      onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                      className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={form.branchName}
                      onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                      className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="support@example.com"
                      className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                    Store Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-[#FAFBFD] border-t border-[#E6EAF0] flex justify-end">
                <button
                  type="submit"
                  className="h-10 px-5 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: USERS & ROLES (Default Active) */}
          {activeTab === 'users-roles' && (
            <div className="pos-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6EAF0] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[16px] font-semibold text-[#111827]">Users &amp; Roles</h2>
                    <span className="text-[12.5px] text-[#9CA3AF] tabular-nums">
                      · {activeStaffCount} of {staffUsers.length} active
                    </span>
                  </div>
                  <p className="text-[13px] text-[#4B5563] mt-0.5">
                    Manage staff accounts, cashier permissions, and POS terminal access
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAddUserModal}
                  className="h-10 px-4 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors shadow-xs whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                  Add User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6EAF0] bg-[#FAFBFD] text-[12px] font-semibold text-[#9CA3AF]">
                      <th className="py-3.5 pl-6 pr-3">Staff Member</th>
                      <th className="py-3.5 px-3">Role</th>
                      <th className="py-3.5 px-3">Phone</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F4F8] text-[13.5px]">
                    {staffUsers.map((user, idx) => {
                      const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
                      return (
                        <tr key={user.id} className="hover:bg-[#F6F8FB] transition-colors">
                          {/* Avatar + Name + Email */}
                          <td className="py-3.5 pl-6 pr-3">
                            <div className="flex items-center gap-3">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover border border-[#E6EAF0] shrink-0"
                                />
                              ) : (
                                <div
                                  className={`w-9 h-9 rounded-full font-semibold text-[12.5px] flex items-center justify-center border border-[#E6EAF0] shrink-0 ${tone}`}
                                >
                                  {getInitials(user.name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-[#111827] whitespace-nowrap">
                                  {user.name}
                                </p>
                                <p className="text-[12px] text-[#9CA3AF] truncate">{user.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold ${getRoleBadgeClass(
                                user.role
                              )}`}
                            >
                              {user.role === 'Admin' && (
                                <ShieldCheck className="w-3.5 h-3.5 stroke-[2]" />
                              )}
                              {user.role}
                            </span>
                          </td>

                          {/* Phone + Last Active */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <p className="text-[#4B5563] tabular-nums">{user.phone}</p>
                            <p className="text-[11.5px] text-[#9CA3AF] tabular-nums">
                              {user.lastActive}
                            </p>
                          </td>

                          {/* Status Toggle */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={user.active}
                                aria-label={`Toggle ${user.name} status`}
                                onClick={() => {
                                  onToggleUserStatus(user.id);
                                  showToast(
                                    `${user.name} ${user.active ? 'deactivated' : 'activated'}`
                                  );
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] ${
                                  user.active ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                                    user.active ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[12.5px] font-medium ${
                                  user.active ? 'text-[#059669]' : 'text-[#9CA3AF]'
                                }`}
                              >
                                {user.active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>

                          {/* Edit / Delete Actions */}
                          <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditUserModal(user)}
                                className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
                                aria-label={`Edit ${user.name}`}
                                title="Edit user"
                              >
                                <Pencil className="w-4 h-4 stroke-[1.75]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(user)}
                                className="p-2 rounded-[8px] text-[#4B5563] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                                aria-label={`Delete ${user.name}`}
                                title="Remove user"
                              >
                                <Trash2 className="w-4 h-4 stroke-[1.75]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TAX & CURRENCY */}
          {activeTab === 'tax-currency' && (
            <form onSubmit={handleSaveForm} className="pos-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6EAF0]">
                <h2 className="text-[16px] font-semibold text-[#111827]">Tax &amp; Currency</h2>
                <p className="text-[13px] text-[#4B5563] mt-0.5">
                  Configure default VAT rate, currency display, and inventory alert thresholds
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Currency Symbol
                    </label>
                    <select
                      value={form.currencySymbol}
                      onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                      className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] bg-white focus:outline-none focus:border-[#4F46E5]"
                    >
                      <option value="৳">৳ (BDT — Bangladeshi Taka)</option>
                      <option value="$">$ (USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Default VAT / Tax (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="25"
                      value={form.vatPercent}
                      onChange={(e) =>
                        setForm({ ...form, vatPercent: Number(e.target.value) || 0 })
                      }
                      className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Default Low Stock Alert
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.lowStockDefault}
                      onChange={(e) =>
                        setForm({ ...form, lowStockDefault: Number(e.target.value) || 10 })
                      }
                      className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between p-4 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] cursor-pointer">
                  <div>
                    <p className="text-[13.5px] font-medium text-[#111827]">
                      Tax-Inclusive Product Pricing
                    </p>
                    <p className="text-[12px] text-[#4B5563] mt-0.5">
                      When disabled, VAT ({form.vatPercent}%) is added on top of POS subtotal
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(form.taxInclusive)}
                    onChange={(e) => setForm({ ...form, taxInclusive: e.target.checked })}
                    className="w-4 h-4 accent-[#4F46E5] rounded"
                  />
                </label>
              </div>
              <div className="px-6 py-4 bg-[#FAFBFD] border-t border-[#E6EAF0] flex justify-end">
                <button
                  type="submit"
                  className="h-10 px-5 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: INVOICE SETTINGS */}
          {activeTab === 'invoice-settings' && (
            <form onSubmit={handleSaveForm} className="pos-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6EAF0]">
                <h2 className="text-[16px] font-semibold text-[#111827]">Invoice Settings</h2>
                <p className="text-[13px] text-[#4B5563] mt-0.5">
                  Customize invoice numbering, print paper format, and receipt footer notes
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Invoice Number Prefix
                    </label>
                    <input
                      type="text"
                      value={form.invoicePrefix || '#INV-'}
                      onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                      className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                      Default Print Format
                    </label>
                    <select
                      value={form.paperSize || 'A4'}
                      onChange={(e) =>
                        setForm({ ...form, paperSize: e.target.value as 'A4' | '80mm' })
                      }
                      className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] bg-white focus:outline-none focus:border-[#4F46E5]"
                    >
                      <option value="A4">A4 Standard Invoice</option>
                      <option value="80mm">80mm Thermal POS Receipt</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] cursor-pointer">
                    <span className="text-[13.5px] font-medium text-[#111827]">
                      Show Verification QR Code
                    </span>
                    <input
                      type="checkbox"
                      checked={form.showQrCode ?? true}
                      onChange={(e) => setForm({ ...form, showQrCode: e.target.checked })}
                      className="w-4 h-4 accent-[#4F46E5]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] cursor-pointer">
                    <span className="text-[13.5px] font-medium text-[#111827]">
                      Show Paid / Due Stamp
                    </span>
                    <input
                      type="checkbox"
                      checked={form.showPaidStamp ?? true}
                      onChange={(e) => setForm({ ...form, showPaidStamp: e.target.checked })}
                      className="w-4 h-4 accent-[#4F46E5]"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1.5">
                    Receipt Thank-You &amp; Exchange Policy Note
                  </label>
                  <textarea
                    rows={3}
                    value={form.receiptFooter}
                    onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                    className="w-full p-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-[#FAFBFD] border-t border-[#E6EAF0] flex justify-end">
                <button
                  type="submit"
                  className="h-10 px-5 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: PAYMENT METHODS */}
          {activeTab === 'payment-methods' && (
            <form onSubmit={handleSaveForm} className="pos-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6EAF0]">
                <h2 className="text-[16px] font-semibold text-[#111827]">Payment Methods</h2>
                <p className="text-[13px] text-[#4B5563] mt-0.5">
                  Enable checkout payment channels and merchant wallet numbers for POS billing
                </p>
              </div>
              <div className="p-6 space-y-3">
                {[
                  {
                    key: 'cash' as const,
                    label: 'Cash Payment',
                    desc: 'Standard drawer cash checkout at the counter',
                  },
                  {
                    key: 'bkash' as const,
                    label: 'bKash Merchant',
                    desc: `Merchant wallet: ${pm.bkashNumber}`,
                  },
                  {
                    key: 'nagad' as const,
                    label: 'Nagad Merchant',
                    desc: `Merchant wallet: ${pm.nagadNumber}`,
                  },
                  {
                    key: 'card' as const,
                    label: 'Card (Visa / Mastercard / Nexus)',
                    desc: 'POS terminal debit and credit card acceptance',
                  },
                  {
                    key: 'due' as const,
                    label: 'Customer Credit / Due',
                    desc: 'Allow registered customers to settle balances later',
                  },
                ].map((method) => {
                  const enabled = pm[method.key];
                  return (
                    <div
                      key={method.key}
                      className="flex items-center justify-between gap-4 p-4 rounded-[10px] border border-[#E6EAF0] bg-white"
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-[#111827]">{method.label}</p>
                        <p className="text-[12.5px] text-[#4B5563] mt-0.5">{method.desc}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() =>
                          setForm({
                            ...form,
                            paymentMethods: { ...pm, [method.key]: !enabled },
                          })
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          enabled ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                            enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-4 bg-[#FAFBFD] border-t border-[#E6EAF0] flex justify-end">
                <button
                  type="submit"
                  className="h-10 px-5 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[440px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111827]">
                {editingUser ? 'Edit Staff User' : 'Add User'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-lg text-[#4B5563] hover:bg-[#F6F8FB]"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Full Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g., Nafisa Tabassum"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                  Email Address <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="000-000-0000"
                    className="w-full h-10 px-3 text-[13.5px] tabular-nums border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#4B5563] mb-1">
                    Role
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as StaffRole)}
                    className="w-full h-10 px-3 text-[13.5px] border border-[#E6EAF0] rounded-[10px] bg-white focus:outline-none focus:border-[#4F46E5]"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Cashier">Cashier</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] cursor-pointer">
                <span className="text-[13px] font-medium text-[#111827]">Account Active</span>
                <input
                  type="checkbox"
                  checked={userActive}
                  onChange={(e) => setUserActive(e.target.checked)}
                  className="w-4 h-4 accent-[#4F46E5]"
                />
              </label>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13.5px] font-semibold"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[400px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold text-[#111827]">Remove Staff User</h3>
            <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
              Remove <span className="font-semibold text-[#111827]">{deleteTarget.name}</span> (
              {deleteTarget.role}) from PayNest POS access?
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-[10px] border border-[#E6EAF0] text-[13.5px] font-medium text-[#4B5563]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUser(deleteTarget.id);
                  showToast(`Removed ${deleteTarget.name}`);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-[10px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13.5px] font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
