/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api/client';
import { useAuth } from './auth/AuthContext';
import { allowedSections, homeForRole } from './utils/navigation';
import { SW_UPDATE_EVENT } from './utils/pwa';
import type {
  Ingredient,
  MenuItem,
  NavSection,
  RestaurantOrder,
  RestaurantSettings,
  RestaurantTable,
} from './types/domain';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Notice } from './components/common/Notice';
import { DashboardView } from './components/views/DashboardView';
import { TablesView } from './components/views/TablesView';
import { WaiterOrderView } from './components/views/WaiterOrderView';
import { KitchenView } from './components/views/KitchenView';
import { MenuView } from './components/views/MenuView';
import { BillingView } from './components/views/BillingView';
import { InventoryView } from './components/views/InventoryView';
import { ReportsView } from './components/views/ReportsView';
import { UsersView } from './components/views/UsersView';
import { SettingsView } from './components/views/SettingsView';
import { TableQrView } from './components/views/TableQrView';
import { LoginView } from './components/views/LoginView';

const FALLBACK_RESTAURANT_NAME = 'PayNest Restaurant';

interface ShellData {
  tables: RestaurantTable[];
  menuItems: MenuItem[];
  orders: RestaurantOrder[];
  lowStockItems: Ingredient[];
  restaurantName: string;
}

const EMPTY_SHELL: ShellData = {
  tables: [],
  menuItems: [],
  orders: [],
  lowStockItems: [],
  restaurantName: FALLBACK_RESTAURANT_NAME,
};

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center text-[14px] text-[#4B5563]">
      Loading…
    </div>
  );
}

export default function App() {
  const {
    user,
    loading: authLoading,
    forbiddenMessage,
    clearForbiddenMessage,
    showForbiddenMessage,
    can,
    login,
    logout,
  } = useAuth();

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 1180 : false
  );
  const [shell, setShell] = useState<ShellData>(EMPTY_SHELL);
  const [shellLoading, setShellLoading] = useState(true);
  const [shellLoaded, setShellLoaded] = useState(false);
  const [shellError, setShellError] = useState('');
  const [activeOrder, setActiveOrder] = useState<RestaurantOrder | null>(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  const sections = useMemo(() => allowedSections(can), [can]);

  useEffect(() => {
    const handleUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener(SW_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, handleUpdate);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && window.innerWidth <= 1180) {
        setSidebarCollapsed(true);
      } else if (window.innerWidth > 1280) {
        setSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Logins always land on the role's home screen; logout clears working state.
  useEffect(() => {
    if (!user) {
      setActiveOrder(null);
      setActiveSection('dashboard');
      setShell(EMPTY_SHELL);
      setShellLoaded(false);
      return;
    }
    setActiveSection(homeForRole(user.role));
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user || !shellLoaded) return;
    if (sections.includes(activeSection)) return;
    const fallback = homeForRole(user.role);
    setActiveSection(sections.includes(fallback) ? fallback : (sections[0] ?? 'dashboard'));
  }, [user, shellLoaded, sections, activeSection]);

  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError && error.status === 403) {
        showForbiddenMessage('You do not have permission to use that action.');
        return;
      }
      setShellError(error instanceof Error ? error.message : fallback);
    },
    [showForbiddenMessage]
  );

  // Data for the shared shell only. Each view owns its own screen data.
  useEffect(() => {
    if (!user || authLoading) return;
    let active = true;
    setShellLoading(true);

    const tasks: Promise<unknown>[] = [];
    const addTask = (request: () => Promise<unknown>, apply: (data: any) => void) => {
      tasks.push(
        request()
          .then((data) => {
            if (active) apply(data);
          })
          .catch((error) => {
            if (active) reportError(error, 'Unable to load the workspace.');
          })
      );
    };

    if (can('tables:read')) addTask(api.getTables, (rows) => setShell((s) => ({ ...s, tables: rows })));
    if (can('menu:read')) addTask(api.getMenuItems, (rows) => setShell((s) => ({ ...s, menuItems: rows })));
    if (can('orders:read')) addTask(api.getOrders, (rows) => setShell((s) => ({ ...s, orders: rows })));
    if (can('inventory:read')) {
      addTask(api.getLowStockIngredients, (rows) => setShell((s) => ({ ...s, lowStockItems: rows })));
    }
    if (can('settings:read')) {
      addTask(api.getSettings, (settings: RestaurantSettings) =>
        setShell((s) => ({ ...s, restaurantName: settings.restaurantName }))
      );
    }

    void Promise.allSettled(tasks).finally(() => {
      if (!active) return;
      setShellLoading(false);
      setShellLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [user?.id, authLoading, can, reportError]);

  const navigate = useCallback(
    (section: NavSection) => {
      if (!sections.includes(section)) {
        showForbiddenMessage('That screen is not available for your role.');
        return;
      }
      clearForbiddenMessage();
      setShellError('');
      setMobileMenuOpen(false);
      setActiveSection(section);
    },
    [sections, showForbiddenMessage, clearForbiddenMessage]
  );

  const selectOrder = useCallback(
    (order: RestaurantOrder) => {
      setActiveOrder(order);
      if (can('orders:write')) navigate('waiter-order');
      else if (can('bills:read')) navigate('billing');
      else navigate('tables');
    },
    [can, navigate]
  );

  const handleSignOut = useCallback(async () => {
    await logout();
  }, [logout]);

  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginView onSignIn={login} />;
  if (shellLoading && !shellLoaded) return <LoadingScreen />;

  const banner = forbiddenMessage || shellError;

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#111827] flex">
      <Sidebar
        activeSection={activeSection}
        onNavigate={navigate}
        lowStockCount={shell.lowStockItems.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        allowedSections={sections}
        restaurantName={shell.restaurantName}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onNavigate={navigate}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectOrder={selectOrder}
          tables={shell.tables}
          menuItems={shell.menuItems}
          orders={shell.orders}
          lowStockItems={shell.lowStockItems}
          onSignOut={() => void handleSignOut()}
          userName={user.name}
          userRole={user.role}
          avatarUrl={user.avatar}
          canManageSettings={can('settings:write')}
        />

        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {banner && <Notice className="mb-4 px-3.5 py-2.5">{banner}</Notice>}
          {swUpdateAvailable && (
            <Notice
              className="mb-4 px-3.5 py-2.5"
              action={
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="shrink-0 rounded-[8px] border border-[#FDE68A] bg-white/70 px-2.5 py-1 text-[12px] font-semibold hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
                >
                  Refresh
                </button>
              }
            >
              New version available, refresh
            </Notice>
          )}

          {activeSection === 'dashboard' && <DashboardView onNavigate={navigate} />}

          {activeSection === 'tables' && (
            <TablesView canTransfer={can('orders:transfer')} onOpenOrder={selectOrder} />
          )}

          {activeSection === 'waiter-order' && (
            <WaiterOrderView activeOrder={activeOrder} onSelectOrder={setActiveOrder} />
          )}

          {activeSection === 'kitchen' && <KitchenView />}

          {activeSection === 'menu' && (
            <MenuView
              canManage={can('menu:write')}
              canToggleAvailability={can('menu:availability') || can('menu:write')}
            />
          )}

          {activeSection === 'billing' && (
            <BillingView
              canDiscount={can('bills:write')}
              canSplit={can('bills:split')}
              canPay={can('bills:pay')}
              canVoid={can('bills:void')}
              initialOrderId={activeOrder?.id}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView canWrite={can('inventory:write')} canEditRecipes={can('recipe:write')} />
          )}

          {activeSection === 'reports' && <ReportsView />}

          {activeSection === 'users' && <UsersView />}

          {activeSection === 'settings' && (
            <SettingsView
              onSaved={(settings) =>
                setShell((current) => ({ ...current, restaurantName: settings.restaurantName }))
              }
            />
          )}

          {activeSection === 'table-qr' && <TableQrView canRotate={can('tables:qr')} />}
        </main>
      </div>
    </div>
  );
}
