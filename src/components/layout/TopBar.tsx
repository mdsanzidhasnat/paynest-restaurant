import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Calendar,
  Bell,
  Menu,
  AlertTriangle,
  ReceiptText,
  Utensils,
  LayoutGrid,
  User,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react';
import type {
  Ingredient,
  MenuItem,
  NavSection,
  RestaurantOrder,
  RestaurantTable,
} from '../../types/domain';
import { formatMoney } from '../../utils/money';

interface TopBarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenMobileMenu: () => void;
  onSelectOrder: (order: RestaurantOrder) => void;
  tables: RestaurantTable[];
  menuItems: MenuItem[];
  orders: RestaurantOrder[];
  lowStockItems: Ingredient[];
  onSignOut: () => void;
  userName: string;
  userRole: string;
  avatarUrl?: string;
  canManageSettings: boolean;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const TopBar: React.FC<TopBarProps> = ({
  onNavigate,
  onOpenMobileMenu,
  onSelectOrder,
  tables,
  menuItems,
  orders,
  lowStockItems,
  onSignOut,
  userName,
  userRole,
  avatarUrl,
  canManageSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openOrders = orders.filter(
    (order) => order.paymentStatus === 'unpaid' && order.status !== 'closed'
  );
  const alertCount = lowStockItems.length + openOrders.length;

  const q = searchQuery.trim().toLowerCase();
  const matchedItems = q
    ? menuItems.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const matchedTables = q
    ? tables.filter((table) => table.number.toLowerCase().includes(q)).slice(0, 3)
    : [];
  const matchedOrders = q
    ? orders
        .filter(
          (order) =>
            order.orderNumber.toLowerCase().includes(q) ||
            (order.billNumber ?? '').toLowerCase().includes(q)
        )
        .slice(0, 3)
    : [];
  const hasResults = matchedItems.length + matchedTables.length + matchedOrders.length > 0;

  const userInitials =
    userName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase() || 'U';
  const displayName = userName.split(/\s+/)[0] || userName;

  function tableNumber(tableId: string): string {
    return tables.find((table) => table.id === tableId)?.number ?? '—';
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  return (
    <header className="no-print h-[72px] bg-[#FFFFFF] border-b border-[#E6EAF0] px-6 lg:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
      {/* Left: Mobile menu toggle + Global Search */}
      <div className="flex items-center gap-4 flex-1 max-w-[460px]" ref={searchRef}>
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-[10px] border border-[#E6EAF0] text-[#4B5563] hover:bg-[#F6F8FB]"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setSearchOpen(true);
            }}
            placeholder="Search menu items, tables or orders..."
            className="w-full h-10 pl-10 pr-4 text-[13.5px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all"
          />

          {searchOpen && q && (
            <div className="absolute left-0 right-0 top-[46px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-lg py-2 z-50 max-h-[380px] overflow-y-auto">
              {!hasResults ? (
                <div className="px-4 py-6 text-center text-[13px] text-[#9CA3AF]">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="divide-y divide-[#F1F4F8]">
                  {matchedItems.length > 0 && (
                    <div className="py-1.5">
                      <p className="px-4 py-1 text-[11px] font-semibold text-[#9CA3AF]">Menu</p>
                      {matchedItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onNavigate('menu');
                            closeSearch();
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-[#F6F8FB] transition-colors"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Utensils className="w-4 h-4 text-[#4F46E5] shrink-0" />
                            <span className="text-[13px] font-medium text-[#111827] truncate">
                              {item.name}
                            </span>
                          </span>
                          <span className="text-[12px] font-semibold text-[#4B5563] tabular-nums ml-3 shrink-0">
                            {formatMoney(item.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedTables.length > 0 && (
                    <div className="py-1.5">
                      <p className="px-4 py-1 text-[11px] font-semibold text-[#9CA3AF]">Tables</p>
                      {matchedTables.map((table) => (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => {
                            onNavigate('tables');
                            closeSearch();
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-[#F6F8FB] transition-colors"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <LayoutGrid className="w-4 h-4 text-[#0284C7] shrink-0" />
                            <span className="text-[13px] font-medium text-[#111827]">
                              Table {table.number}
                            </span>
                          </span>
                          <span className="text-[12px] text-[#9CA3AF] ml-3 shrink-0">
                            {table.floorName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedOrders.length > 0 && (
                    <div className="py-1.5">
                      <p className="px-4 py-1 text-[11px] font-semibold text-[#9CA3AF]">Orders</p>
                      {matchedOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            onSelectOrder(order);
                            closeSearch();
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-[#F6F8FB] transition-colors"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <ReceiptText className="w-4 h-4 text-[#10B981] shrink-0" />
                            <span className="text-[13px] font-medium text-[#111827] truncate">
                              {order.orderNumber} — Table {tableNumber(order.tableId)}
                            </span>
                          </span>
                          <span className="text-[12px] font-semibold text-[#4B5563] tabular-nums ml-3 shrink-0">
                            {formatMoney(order.total)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Date, Notification Bell, User Avatar */}
      <div className="flex items-center gap-5 shrink-0">
        <div className="hidden md:flex items-center gap-2 text-[13px] font-medium text-[#4B5563] px-3 py-1.5 rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] whitespace-nowrap">
          <Calendar className="w-4 h-4 text-[#6B7280] stroke-[1.75]" />
          <span className="tabular-nums">{todayLabel()}</span>
        </div>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative w-10 h-10 rounded-[10px] border border-[#E6EAF0] bg-white hover:bg-[#F6F8FB] flex items-center justify-center text-[#4B5563] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
            aria-label="View notifications"
          >
            <Bell className="w-[18px] h-[18px] stroke-[1.75]" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums border-2 border-white">
                {alertCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[48px] w-[340px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E6EAF0] flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-[#111827]">Restaurant alerts</span>
                <span className="text-[12px] font-medium text-[#4F46E5] tabular-nums">
                  {alertCount} active
                </span>
              </div>
              <div className="max-h-[320px] overflow-y-auto divide-y divide-[#F1F4F8]">
                {lowStockItems.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate('inventory');
                      setNotifOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-[#F6F8FB] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#111827] truncate">{item.name}</p>
                      <p className="text-[12px] text-[#4B5563] mt-0.5 tabular-nums">
                        Only <span className="font-semibold text-[#EF4444]">{item.stock}</span>{' '}
                        {item.unit} left
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-1" />
                  </button>
                ))}
                {openOrders.slice(0, 3).map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      onSelectOrder(order);
                      setNotifOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-[#F6F8FB] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center shrink-0 mt-0.5">
                      <ReceiptText className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#111827] truncate">
                        {order.orderNumber} — Table {tableNumber(order.tableId)}
                      </p>
                      <p className="text-[12px] text-[#4B5563] mt-0.5 tabular-nums">
                        {formatMoney(order.total)} · {order.status.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-1" />
                  </button>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-[#F6F8FB] border-t border-[#E6EAF0] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('inventory');
                    setNotifOpen(false);
                  }}
                  className="text-[12.5px] font-medium text-[#4F46E5] hover:underline"
                >
                  Review low stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('tables');
                    setNotifOpen(false);
                  }}
                  className="text-[12.5px] font-medium text-[#4B5563] hover:text-[#111827]"
                >
                  View tables
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-[#E6EAF0] hidden sm:block" />

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-3 text-left rounded-[10px] py-1 pr-2 pl-1 hover:bg-[#F6F8FB] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
          >
            {avatarFailed || !avatarUrl ? (
              <div className="w-9 h-9 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-semibold text-[13px] flex items-center justify-center border border-[#E6EAF0]">
                {userInitials}
              </div>
            ) : (
              <img
                src={avatarUrl}
                alt={`${displayName} — ${userRole}`}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-9 h-9 rounded-full object-cover border border-[#E6EAF0]"
              />
            )}
            <div className="hidden sm:block leading-tight">
              <p className="text-[13.5px] font-semibold text-[#111827] whitespace-nowrap">
                {displayName}
              </p>
              <p className="text-[11.5px] text-[#9CA3AF] whitespace-nowrap">{userRole}</p>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[48px] w-[190px] bg-white border border-[#E6EAF0] rounded-[12px] shadow-lg py-1.5 z-50">
              {canManageSettings && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('settings');
                      setProfileOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[13px] font-medium text-[#111827] hover:bg-[#F6F8FB] inline-flex items-center gap-2.5"
                  >
                    <Settings className="w-4 h-4 text-[#4B5563]" />
                    Restaurant settings
                  </button>
                  <div className="my-1 border-t border-[#F1F4F8]" />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onSignOut();
                }}
                className="w-full px-3.5 py-2 text-left text-[13px] font-medium text-[#EF4444] hover:bg-[#FEF2F2] inline-flex items-center gap-2.5"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
