import React from 'react';
import {
  LayoutDashboard,
  LayoutGrid,
  ClipboardList,
  ChefHat,
  Utensils,
  ReceiptText,
  Package,
  BarChart3,
  Users,
  Settings,
  Store,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  X,
} from 'lucide-react';
import { NavSection } from '../../types/pos';

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  lowStockCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  allowedSections?: NavSection[];
  restaurantName?: string;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onNavigate,
  lowStockCount,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
  allowedSections,
  restaurantName = 'PayNest Restaurant',
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tables', label: 'Tables', icon: LayoutGrid },
    { id: 'waiter-order', label: 'Waiter Orders', icon: ClipboardList },
    { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat },
    { id: 'menu', label: 'Menu', icon: Utensils },
    { id: 'billing', label: 'Billing', icon: ReceiptText },
    {
      id: 'inventory',
      label: 'Ingredients',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'table-qr', label: 'Table QR', icon: QrCode },
  ];

  const visibleNavItems = allowedSections
    ? navItems.filter((item) => allowedSections.includes(item.id))
    : navItems;

  const handleSelect = (id: NavSection) => {
    onNavigate(id);
    onCloseMobile();
  };

  const renderSidebarBody = (isCollapsed: boolean) => (
    <aside
      className={`h-full bg-[#FFFFFF] border-r border-[#E6EAF0] flex flex-col justify-between select-none transition-all duration-200 ${
        isCollapsed ? 'w-[78px]' : 'w-[260px]'
      }`}
    >
      <div>
        {/* Brand Logo Header */}
        <div
          className={`h-[72px] flex items-center border-b border-[#E6EAF0] ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSelect('dashboard')}
            title="PayNest Restaurant"
            className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded-lg"
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#4F46E5] flex items-center justify-center shadow-sm shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-white"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M7 10h4" />
                <path d="M7 14h2" />
                <path d="M15 10h2v4h-2z" />
                <path d="M6 21h12" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="text-[17px] font-bold tracking-[-0.02em] text-[#111827] whitespace-nowrap">
                PayNest Restaurant
              </span>
            )}
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:inline-flex p-2 rounded-[9px] text-[#6B7280] hover:text-[#4F46E5] hover:bg-[#F6F8FB] transition-colors"
                aria-label="Collapse sidebar to icons"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-2 rounded-lg text-[#4B5563] hover:bg-[#F3F5F9]"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Expand button when collapsed */}
        {isCollapsed && (
          <div className="px-3 pt-3 pb-1 hidden lg:flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-12 h-10 rounded-[10px] border border-[#E6EAF0] bg-[#F6F8FB] hover:bg-[#EEF2FF] hover:border-[#4F46E5]/40 text-[#4B5563] hover:text-[#4F46E5] flex items-center justify-center transition-colors"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-[18px] h-[18px] stroke-[1.75]" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav
          className={`py-3 space-y-1 ${isCollapsed ? 'px-2.5' : 'px-3'}`}
          aria-label="Primary Sidebar Navigation"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={isCollapsed ? item.label : undefined}
                aria-label={item.label}
                className={`relative w-full flex items-center rounded-[10px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] ${
                  isCollapsed
                    ? 'justify-center h-12 px-0'
                    : 'justify-between px-3.5 py-2.5 min-h-[42px] text-[14px]'
                } ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#4F46E5]'
                    : 'text-[#4B5563] hover:bg-[#F6F8FB] hover:text-[#111827]'
                }`}
              >
                <span className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon
                    className={`shrink-0 stroke-[1.75] ${
                      isCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'
                    } ${isActive ? 'text-[#4F46E5]' : 'text-[#6B7280]'}`}
                  />
                  {!isCollapsed && (
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  )}
                </span>
                {item.badge !== undefined && !isCollapsed && (
                  <span
                    className={`ml-2 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-[#4F46E5]/15 text-[#4F46E5]'
                        : 'bg-[#FEF2F2] text-[#EF4444]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.badge !== undefined && isCollapsed && (
                  <span className="absolute top-1.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Store Outlet Footer */}
      <div className="p-3 border-t border-[#E6EAF0]">
        {isCollapsed ? (
          <div
            title={`${restaurantName} — staff workspace`}
            className="w-11 h-11 mx-auto rounded-[10px] bg-[#F6F8FB] border border-[#E6EAF0] flex items-center justify-center text-[#4F46E5]"
          >
            <Store className="w-5 h-5 stroke-[1.75]" />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] bg-[#F6F8FB]">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#E6EAF0] flex items-center justify-center text-[#4F46E5] shrink-0">
              <Store className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111827] truncate">{restaurantName}</p>
              <p className="text-[11px] text-[#9CA3AF] truncate">Staff workspace</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop / Tablet Collapsible Sidebar */}
      <div
        className={`no-print hidden lg:block shrink-0 h-screen sticky top-0 transition-all duration-200 ${
          collapsed ? 'w-[78px]' : 'w-[260px]'
        }`}
      >
        {renderSidebarBody(collapsed)}
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#111827]/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{renderSidebarBody(false)}</div>
        </div>
      )}
    </>
  );
};
