/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api/client';
import { isApiForbidden, useAuth, type Permission } from './auth/AuthContext';
import {
  Category,
  Customer,
  DailySalesPoint,
  DuePaymentMethod,
  DuePaymentRecord,
  NavSection,
  PaymentMethod,
  Product,
  PurchaseOrder,
  SaleInvoice,
  StaffUser,
  StoreSettings,
  Supplier,
} from './types/pos';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { InvoiceModal } from './components/modals/InvoiceModal';
import { DashboardView } from './components/views/DashboardView';
import { PosTerminalView } from './components/views/PosTerminalView';
import { ProductsView } from './components/views/ProductsView';
import { AddProductView } from './components/views/AddProductView';
import { CategoriesView } from './components/views/CategoriesView';
import { InventoryView } from './components/views/InventoryView';
import { CustomersView } from './components/views/CustomersView';
import { DueCollectionView } from './components/views/DueCollectionView';
import { SuppliersView } from './components/views/SuppliersView';
import { PurchasesView } from './components/views/PurchasesView';
import { SalesHistoryView } from './components/views/SalesHistoryView';
import { InvoicePreviewView } from './components/views/InvoicePreviewView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { TableQrView } from './components/views/TableQrView';
import { LoginView } from './components/views/LoginView';

const EMPTY_SETTINGS: StoreSettings = {
  storeName: '',
  branchName: '',
  phone: '',
  address: '',
  currencySymbol: '৳',
  vatPercent: 0,
  lowStockDefault: 12,
  receiptFooter: '',
};

export default function App() {
  const { user, loading: authLoading, forbiddenMessage, showForbiddenMessage, clearForbiddenMessage, can, login, logout } =
    useAuth();
  const isAuthenticated = Boolean(user);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 1180 : false
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

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

  // Core POS State, populated by the API after authentication.
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [weeklySales, setWeeklySales] = useState<DailySalesPoint[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(EMPTY_SETTINGS);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [duePayments, setDuePayments] = useState<DuePaymentRecord[]>([]);

  // Dashboard Headline KPIs (start at exact requested figures: ৳48,250, 126, ৳9,870, 8)
  const [todaySales, setTodaySales] = useState<number>(48250);
  const [totalOrders, setTotalOrders] = useState<number>(126);
  const [totalProfit, setTotalProfit] = useState<number>(9870);

  const [inspectedInvoice, setInspectedInvoice] = useState<SaleInvoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<SaleInvoice | null>(null);

  // Global Barcode Scanner State (prefix detection + quick search + auto-add)
  const [liveScanQuery, setLiveScanQuery] = useState<string>('');
  const [pendingBarcodeScan, setPendingBarcodeScan] = useState<{
    id: number;
    code: string;
  } | null>(null);

  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scanResetTimerRef = useRef<number | null>(null);
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;

  const allowedSections = useMemo<NavSection[]>(() => {
    const sections: NavSection[] = [];
    if (can('dashboard:read')) sections.push('dashboard');
    sections.push('pos');
    if (can('tables:read') || can('tables:qr')) sections.push('table-qr');
    if (can('products:read')) sections.push('products');
    if (can('products:write')) sections.push('add-product');
    if (can('categories:read')) sections.push('categories');
    if (can('inventory:read')) sections.push('inventory');
    if (can('customers:read')) sections.push('customers');
    if (can('dues:read')) sections.push('due-collection');
    if (can('suppliers:read')) sections.push('suppliers');
    if (can('purchases:read')) sections.push('purchases');
    if (can('sales:create') || can('sales:read')) sections.push('invoice-preview');
    if (can('sales:read')) sections.push('sales-history');
    if (can('reports:read')) sections.push('reports');
    if (can('settings:write')) sections.push('settings');
    return Array.from(new Set(sections));
  }, [can]);

  useEffect(() => {
    if (!user || authLoading) return;
    if (!allowedSections.includes(activeSection)) {
      setActiveSection(can('dashboard:read') ? 'dashboard' : 'pos');
    }
  }, [user, authLoading, allowedSections, activeSection, can]);

  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      if (isApiForbidden(error)) {
        showForbiddenMessage('You do not have permission to use that action.');
        return;
      }
      setActionError(error instanceof ApiError || error instanceof Error ? error.message : fallback);
    },
    [showForbiddenMessage]
  );

  const runAction = useCallback(
    async (action: () => Promise<unknown>, fallback: string) => {
      try {
        await action();
        setActionError('');
        clearForbiddenMessage();
      } catch (error) {
        reportError(error, fallback);
      }
    },
    [clearForbiddenMessage, reportError]
  );

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setDataLoading(true);

    const addTask = (
      permission: Permission,
      fallback: string,
      request: () => Promise<unknown>,
      apply: (data: any) => void
    ) => {
      if (!can(permission)) return;
      tasks.push(
        request()
          .then((data) => {
            if (active) apply(data);
          })
          .catch((error) => {
            if (active) reportError(error, fallback);
          })
      );
    };

    const tasks: Promise<unknown>[] = [];
    addTask('dashboard:read', 'Unable to load dashboard figures.', api.getDashboard, (data) => {
      setTodaySales(data.todaySales);
      setTotalOrders(data.totalOrders);
      setTotalProfit(data.totalProfit);
      setWeeklySales(data.weeklySales);
    });
    addTask('reports:read', 'Unable to load reports.', api.getReports, (data) => {
      setWeeklySales(data.weeklySales);
      setCategories(data.categories);
    });
    addTask('products:read', 'Unable to load products.', api.getProducts, setProducts);
    addTask('categories:read', 'Unable to load categories.', api.getCategories, setCategories);
    addTask(
      'inventory:read',
      'Unable to load inventory.',
      api.getInventory,
      (data) => setProducts(data.products)
    );
    addTask('customers:read', 'Unable to load customers.', api.getCustomers, setCustomers);
    addTask('dues:read', 'Unable to load payment history.', api.getDues, setDuePayments);
    addTask('suppliers:read', 'Unable to load suppliers.', api.getSuppliers, setSuppliers);
    addTask('purchases:read', 'Unable to load purchases.', api.getPurchases, setPurchases);
    addTask('sales:read', 'Unable to load sales history.', api.getSales, setInvoices);
    addTask(
      'invoice-settings:read',
      'Unable to load invoice settings.',
      api.getInvoiceSettings,
      setSettings
    );
    addTask('settings:read', 'Unable to load store settings.', api.getSettings, setSettings);
    addTask('users:read', 'Unable to load staff users.', api.getUsers, setStaffUsers);

    Promise.allSettled(tasks).finally(() => {
      if (active) {
        setDataLoading(false);
        setHasLoaded(true);
      }
    });

    return () => {
      active = false;
    };
  }, [userId, reloadToken, can, reportError]);

  useEffect(() => {
    if (!user) return;

    const SCAN_PREFIXES = ['pn-', 'bc:', 'scan:', '~', ']'];

    const stripScannerPrefix = (raw: string): string => {
      let cleaned = raw.trim();
      if (cleaned.startsWith('~') || cleaned.startsWith(']')) {
        cleaned = cleaned.slice(1);
      }
      if (/^(bc:|scan:)/i.test(cleaned)) {
        cleaned = cleaned.replace(/^(bc:|scan:)/i, '');
      }
      return cleaned.trim();
    };

    const hasScannerPrefix = (buf: string): boolean => {
      const lower = buf.toLowerCase();
      return (
        SCAN_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
        /^\d{3,}$/.test(lower)
      );
    };

    const clearScanBuffer = () => {
      scanBufferRef.current = '';
      setLiveScanQuery('');
      if (scanResetTimerRef.current !== null) {
        window.clearTimeout(scanResetTimerRef.current);
        scanResetTimerRef.current = null;
      }
    };

    const scheduleBufferReset = () => {
      if (scanResetTimerRef.current !== null) {
        window.clearTimeout(scanResetTimerRef.current);
      }
      scanResetTimerRef.current = window.setTimeout(() => {
        clearScanBuffer();
      }, 1100);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditable) return;

      if (e.key === 'Escape') {
        if (scanBufferRef.current) {
          clearScanBuffer();
        }
        return;
      }

      const now = Date.now();
      const deltaMs = now - lastKeyTimeRef.current;

      // Reset stale slow manual buffer unless still within scanner window
      if (scanBufferRef.current && deltaMs > 900) {
        scanBufferRef.current = '';
      }

      if (e.key === 'Backspace') {
        if (scanBufferRef.current.length > 0) {
          e.preventDefault();
          scanBufferRef.current = scanBufferRef.current.slice(0, -1);
          const stripped = stripScannerPrefix(scanBufferRef.current);
          setLiveScanQuery(hasScannerPrefix(scanBufferRef.current) ? stripped : '');
          scheduleBufferReset();
        }
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const raw = scanBufferRef.current.trim();
        if (!raw) return;

        const cleaned = stripScannerPrefix(raw);
        const isValidScan =
          hasScannerPrefix(raw) || (deltaMs <= 120 && cleaned.length >= 3);

        if (isValidScan && cleaned.length >= 2) {
          e.preventDefault();
          // Ensure POS screen is active so the item is added & visible without manual clicking
          setActiveSection((curr) => (curr === 'pos' ? curr : 'pos'));
          setPendingBarcodeScan({
            id: now + Math.random(),
            code: cleaned,
          });
          clearScanBuffer();
        } else {
          clearScanBuffer();
        }
        return;
      }

      // Accept printable single-character keys
      if (e.key.length === 1) {
        const nextBuffer = scanBufferRef.current + e.key;
        const lowerNext = nextBuffer.toLowerCase();

        // Check if buffer matches or is building toward a recognized scanner prefix or rapid HID stream
        const isCandidatePrefix =
          'pn-'.startsWith(lowerNext) ||
          'bc:'.startsWith(lowerNext) ||
          'scan:'.startsWith(lowerNext) ||
          lowerNext.startsWith('~') ||
          lowerNext.startsWith(']') ||
          /^\d+$/.test(lowerNext);

        const isActivePrefix = hasScannerPrefix(nextBuffer);
        const isRapidScannerBurst = scanBufferRef.current.length > 0 && deltaMs <= 75;

        if (isCandidatePrefix || isActivePrefix || isRapidScannerBurst) {
          // Prevent space/slash from scrolling page during scan
          if (e.key === ' ') e.preventDefault();
          scanBufferRef.current = nextBuffer;
          lastKeyTimeRef.current = now;

          if (isActivePrefix || isRapidScannerBurst) {
            const stripped = stripScannerPrefix(nextBuffer);
            setLiveScanQuery(stripped);

            // Auto-switch to POS on confirmed prefix if not already there for live quick search
            if (isActivePrefix && stripped.length >= 2) {
              setActiveSection((curr) => (curr === 'pos' ? curr : 'pos'));
            }
          }
          scheduleBufferReset();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (scanResetTimerRef.current !== null) {
        window.clearTimeout(scanResetTimerRef.current);
      }
    };
  }, [user]);

  const handleOpenInvoicePreview = (invoice: SaleInvoice) => {
    setPreviewInvoice(invoice);
    setActiveSection('invoice-preview');
  };

  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;

  const handleCompleteSale = async (payload: {
    customerId: string;
    customerName: string;
    items: { product: Product; quantity: number }[];
    discount: number;
    vat: number;
    paymentMethod: PaymentMethod;
  }) => {
    await runAction(
      async () => {
        const invoice = await api.createSale(payload);
        setInvoices((prev) => [invoice, ...prev]);
        setPreviewInvoice(invoice);
        reload();
        setActiveSection('invoice-preview');
      },
      'Unable to complete the sale.'
    );
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target || target.paymentStatus === 'Paid') return;

    await runAction(
      async () => {
        const updated = await api.markSalePaid(invoiceId);
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
        setInspectedInvoice((prev) => (prev && prev.id === invoiceId ? updated : prev));
        setPreviewInvoice((prev) => (prev && prev.id === invoiceId ? updated : prev));
        reload();
      },
      'Unable to mark the invoice as paid.'
    );
  };

  const handleRestock = async (productId: string, addQty: number) => {
    await runAction(
      async () => {
        const updated = await api.restockProduct(productId, addQty);
        setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      },
      'Unable to restock the product.'
    );
  };

  const handleAddProduct = async (
    newProd: Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>
  ) => {
    await runAction(
      async () => {
        const created = await api.createProduct(newProd);
        setProducts((prev) => [created, ...prev]);
      },
      'Unable to add the product.'
    );
  };

  const handleUpdateProduct = async (updated: Product) => {
    await runAction(
      async () => {
        const saved = await api.updateProduct(updated);
        setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      },
      'Unable to update the product.'
    );
  };

  const handleDeleteProduct = async (productId: string) => {
    await runAction(
      async () => {
        await api.deleteProduct(productId);
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      },
      'Unable to delete the product.'
    );
  };

  const handleImportProducts = async (
    imported: Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>[]
  ) => {
    await runAction(
      async () => {
        const created = await api.importProducts(imported);
        setProducts((prev) => [...created, ...prev]);
      },
      'Unable to import products.'
    );
  };

  const handleAddCategory = async (cat: {
    name: string;
    description: string;
    color: string;
  }) => {
    await runAction(
      async () => {
        const created = await api.createCategory(cat);
        setCategories((prev) => [...prev, created]);
      },
      'Unable to add the category.'
    );
  };

  const handleAddCustomer = async (cust: {
    name: string;
    phone: string;
    email: string;
    area: string;
  }) => {
    await runAction(
      async () => {
        const created = await api.createCustomer(cust);
        setCustomers((prev) => [created, ...prev]);
      },
      'Unable to add the customer.'
    );
  };

  const handleUpdateCustomer = async (updated: Customer) => {
    await runAction(
      async () => {
        const saved = await api.updateCustomer(updated);
        setCustomers((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      },
      'Unable to update the customer.'
    );
  };

  const handleDeleteCustomer = async (customerId: string) => {
    await runAction(
      async () => {
        await api.deleteCustomer(customerId);
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      },
      'Unable to delete the customer.'
    );
  };

  const handleCollectDue = async (customerId: string) => {
    await runAction(
      async () => {
        const updated = await api.collectCustomerDue(customerId);
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        reload();
      },
      'Unable to collect the due amount.'
    );
  };

  const handleCollectDuePayment = async (payload: {
    customerId: string;
    amount: number;
    method: DuePaymentMethod;
    note: string;
  }) => {
    const targetCustomer = customers.find((c) => c.id === payload.customerId);
    if (!targetCustomer) return;

    await runAction(
      async () => {
        const payment = await api.createDuePayment(payload);
        setDuePayments((prev) => [payment, ...prev]);
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === payment.customerId ? { ...c, dueBalance: payment.remainingDue } : c
          )
        );
        reload();
      },
      'Unable to record the payment.'
    );
  };

  const handleSettlePayable = async (supplierId: string) => {
    await runAction(
      async () => {
        const updated = await api.settleSupplierPayable(supplierId);
        setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      },
      'Unable to settle the payable amount.'
    );
  };

  const handleReceivePurchase = async (purchaseId: string) => {
    await runAction(
      async () => {
        const updated = await api.receivePurchase(purchaseId);
        setPurchases((prev) => prev.map((po) => (po.id === updated.id ? updated : po)));
      },
      'Unable to receive the order.'
    );
  };

  const handleAddPurchase = async (po: {
    supplierName: string;
    itemsSummary: string;
    itemCount: number;
    totalAmount: number;
    paidAmount: number;
    status: 'Received' | 'Pending';
    date: string;
  }) => {
    await runAction(
      async () => {
        const created = await api.createPurchase(po);
        setPurchases((prev) => [created, ...prev]);
      },
      'Unable to add the purchase order.'
    );
  };

  const handleRecordPurchasePayment = async (purchaseId: string, payAmount: number) => {
    await runAction(
      async () => {
        const updated = await api.recordPurchasePayment(purchaseId, payAmount);
        setPurchases((prev) => prev.map((po) => (po.id === updated.id ? updated : po)));
      },
      'Unable to record the payment.'
    );
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    await runAction(
      async () => {
        await api.deletePurchase(purchaseId);
        setPurchases((prev) => prev.filter((po) => po.id !== purchaseId));
      },
      'Unable to delete the purchase order.'
    );
  };

  const handleSaveSettings = async (updated: StoreSettings) => {
    await runAction(
      async () => {
        const saved = await api.updateSettings(updated);
        setSettings(saved);
      },
      'Unable to save settings.'
    );
  };

  const handleAddUser = async (newUser: Omit<StaffUser, 'id' | 'lastActive'>) => {
    await runAction(
      async () => {
        const created = await api.createUser(newUser as Parameters<typeof api.createUser>[0]);
        setStaffUsers((prev) => [...prev, created]);
      },
      'Unable to add the user.'
    );
  };

  const handleUpdateUser = async (updatedUser: StaffUser) => {
    await runAction(
      async () => {
        const saved = await api.updateUser(updatedUser);
        setStaffUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
      },
      'Unable to update the user.'
    );
  };

  const handleToggleUserStatus = async (userIdToToggle: string) => {
    await runAction(
      async () => {
        const updated = await api.toggleUser(userIdToToggle);
        setStaffUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      },
      'Unable to change the user status.'
    );
  };

  const handleDeleteUser = async (userIdToDelete: string) => {
    await runAction(
      async () => {
        await api.deleteUser(userIdToDelete);
        setStaffUsers((prev) => prev.filter((u) => u.id !== userIdToDelete));
      },
      'Unable to delete the user.'
    );
  };

  const handleSignOut = async () => {
    await logout();
    setActiveSection('dashboard');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center text-[14px] text-[#4B5563]">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginView onSignIn={login} />;
  }

  if (dataLoading && !hasLoaded) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center text-[14px] text-[#4B5563]">
        Loading…
      </div>
    );
  }

  const canWriteProducts = can('products:write');
  const canDeleteProducts = can('products:delete');
  const canWriteCustomers = can('customers:write');
  const canDeleteCustomers = can('customers:delete');
  const canWritePurchases = can('purchases:write');
  const canDeletePurchases = can('purchases:delete');
  const canRestock = can('inventory:write');
  const canManageSettings = can('settings:write');
  const canManageUsers = can('users:write');

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#111827] flex">
      {/* Left Collapsible Sidebar (260px desktop / 78px icons-only tablet) */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        lowStockCount={lowStockCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        allowedSections={allowedSections}
      />

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onNavigate={setActiveSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          products={products}
          customers={customers}
          invoices={invoices}
          onInspectInvoice={handleOpenInvoicePreview}
          onSignOut={handleSignOut}
          userName={user.name}
          userRole={user.role}
          avatarUrl={user.avatar}
          canManageSettings={canManageSettings}
        />

        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {(forbiddenMessage || actionError) && (
            <div className="mb-4 px-3.5 py-2.5 rounded-[10px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[13px] font-medium">
              {forbiddenMessage || actionError}
            </div>
          )}

          {activeSection === 'dashboard' && (
            <DashboardView
              todaySales={todaySales}
              totalOrders={totalOrders}
              totalProfit={totalProfit}
              lowStockCount={lowStockCount}
              weeklySales={weeklySales}
              categories={categories}
              invoices={invoices}
              products={products}
              onNavigate={setActiveSection}
              onInspectInvoice={handleOpenInvoicePreview}
            />
          )}

          {activeSection === 'pos' && (
            <PosTerminalView
              products={products}
              customers={customers}
              vatPercent={settings.vatPercent}
              onCompleteSale={handleCompleteSale}
              liveScanQuery={liveScanQuery}
              pendingBarcodeScan={pendingBarcodeScan}
            />
          )}

          {activeSection === 'table-qr' && <TableQrView canRotate={can('tables:qr')} />}

          {activeSection === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onImportProducts={handleImportProducts}
              onOpenAddProduct={() => {
                setEditingProduct(null);
                setActiveSection('add-product');
              }}
              onOpenEditProduct={(prod) => {
                setEditingProduct(prod);
                setActiveSection('add-product');
              }}
              canWrite={canWriteProducts}
              canDelete={canDeleteProducts}
            />
          )}

          {activeSection === 'add-product' && (
            <AddProductView
              categories={categories}
              existingCount={products.length}
              editingProduct={editingProduct}
              onCancel={() => {
                setEditingProduct(null);
                setActiveSection('products');
              }}
              onSave={(payload, editingId) => {
                if (editingId && editingProduct) {
                  void handleUpdateProduct({
                    ...editingProduct,
                    ...payload,
                  });
                } else {
                  void handleAddProduct(payload);
                }
                setEditingProduct(null);
                setActiveSection('products');
              }}
            />
          )}

          {activeSection === 'categories' && (
            <CategoriesView
              categories={categories}
              products={products}
              onAddCategory={handleAddCategory}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView products={products} onRestock={handleRestock} canRestock={canRestock} />
          )}

          {activeSection === 'customers' && (
            <CustomersView
              customers={customers}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onCollectDue={handleCollectDue}
              canWrite={canWriteCustomers}
              canDelete={canDeleteCustomers}
            />
          )}

          {activeSection === 'due-collection' && (
            <DueCollectionView
              customers={customers}
              paymentHistory={duePayments}
              onCollectPayment={handleCollectDuePayment}
            />
          )}

          {activeSection === 'suppliers' && (
            <SuppliersView suppliers={suppliers} onSettlePayable={handleSettlePayable} />
          )}

          {activeSection === 'purchases' && (
            <PurchasesView
              purchases={purchases}
              suppliers={suppliers}
              onReceiveOrder={handleReceivePurchase}
              onAddPurchase={handleAddPurchase}
              onRecordPayment={handleRecordPurchasePayment}
              onDeletePurchase={handleDeletePurchase}
              canWrite={canWritePurchases}
              canDelete={canDeletePurchases}
            />
          )}

          {activeSection === 'sales-history' && (
            <SalesHistoryView invoices={invoices} onInspectInvoice={handleOpenInvoicePreview} />
          )}

          {activeSection === 'invoice-preview' && previewInvoice && (
            <InvoicePreviewView
              invoice={previewInvoice}
              allInvoices={invoices}
              customers={customers}
              settings={settings}
              onSelectInvoice={setPreviewInvoice}
              onBack={() => setActiveSection(can('sales:read') ? 'sales-history' : 'pos')}
              onMarkPaid={handleMarkInvoicePaid}
            />
          )}

          {activeSection === 'reports' && (
            <ReportsView
              weeklySales={weeklySales}
              categories={categories}
              invoices={invoices}
              products={products}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              staffUsers={staffUsers}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onToggleUserStatus={handleToggleUserStatus}
              onDeleteUser={handleDeleteUser}
              canManageUsers={canManageUsers}
            />
          )}
        </main>
      </div>

      {/* Invoice / Receipt Modal */}
      <InvoiceModal
        invoice={inspectedInvoice}
        settings={settings}
        onClose={() => setInspectedInvoice(null)}
        onMarkPaid={handleMarkInvoicePaid}
      />
    </div>
  );
}
