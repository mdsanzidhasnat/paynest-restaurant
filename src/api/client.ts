import type {
  Category,
  Customer,
  DailySalesPoint,
  DuePaymentMethod,
  DuePaymentRecord,
  PaymentMethod,
  Product,
  PublicCartLine,
  PublicMenu,
  PublicOrderResult,
  PublicOrderStatusResult,
  PurchaseOrder,
  SaleInvoice,
  StaffRole,
  StaffTable,
  StaffUser,
  StoreSettings,
  Supplier,
  TableQr,
} from '../types/pos';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  avatar?: string;
  lastActive: string;
  permissions: string[];
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

function body(data: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(data) };
}

/** Guest calls never touch the staff session or its 401 handler. */
async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/public${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

export type ProductInput = Omit<Product, 'id' | 'soldToday' | 'soldThisWeek'>;

export interface SalePayload {
  customerId: string;
  customerName: string;
  items: { product: Product; quantity: number }[];
  discount: number;
  vat: number;
  paymentMethod: PaymentMethod;
}

export interface DashboardData {
  todaySales: number;
  totalOrders: number;
  totalProfit: number;
  lowStockCount: number;
  weeklySales: DailySalesPoint[];
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthUser>('/auth/login', body({ email, password })),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<AuthUser>('/auth/me'),

  getTables: () => request<StaffTable[]>('/tables'),
  getTableQr: (tableId: string) =>
    request<TableQr>(`/tables/${encodeURIComponent(tableId)}/qr`),
  rotateTableQr: (tableId: string) =>
    request<TableQr>(`/tables/${encodeURIComponent(tableId)}/qr/rotate`, body({})),

  getDashboard: () => request<DashboardData>('/dashboard'),
  getReports: () =>
    request<DashboardData & { categories: Category[]; totalRevenue: number; totalExpense: number }>(
      '/reports'
    ),

  getProducts: () => request<Product[]>('/products'),
  createProduct: (product: ProductInput) => request<Product>('/products', body(product)),
  updateProduct: (product: Product) =>
    request<Product>(`/products/${encodeURIComponent(product.id)}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  importProducts: (products: ProductInput[]) => request<Product[]>('/products/import', body({ products })),

  getCategories: () => request<Category[]>('/categories'),
  createCategory: (category: { name: string; description: string; color: string }) =>
    request<Category>('/categories', body(category)),

  getInventory: () => request<{ products: Product[]; lowStockCount: number }>('/inventory'),
  restockProduct: (productId: string, quantity: number) =>
    request<Product>('/inventory/restock', body({ productId, quantity })),

  getCustomers: () => request<Customer[]>('/customers'),
  createCustomer: (customer: { name: string; phone: string; email: string; area: string }) =>
    request<Customer>('/customers', body(customer)),
  updateCustomer: (customer: Customer) =>
    request<Customer>(`/customers/${encodeURIComponent(customer.id)}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    }),
  deleteCustomer: (id: string) =>
    request<void>(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  collectCustomerDue: (id: string) =>
    request<Customer>(`/customers/${encodeURIComponent(id)}/collect-due`, { method: 'POST' }),

  getSuppliers: () => request<Supplier[]>('/suppliers'),
  settleSupplierPayable: (id: string) =>
    request<Supplier>(`/suppliers/${encodeURIComponent(id)}/settle`, { method: 'POST' }),

  getPurchases: () => request<PurchaseOrder[]>('/purchases'),
  createPurchase: (purchase: Omit<PurchaseOrder, 'id' | 'poNumber'>) =>
    request<PurchaseOrder>('/purchases', body(purchase)),
  receivePurchase: (id: string) =>
    request<PurchaseOrder>(`/purchases/${encodeURIComponent(id)}/receive`, { method: 'POST' }),
  recordPurchasePayment: (id: string, amount: number) =>
    request<PurchaseOrder>(`/purchases/${encodeURIComponent(id)}/payment`, body({ amount })),
  deletePurchase: (id: string) =>
    request<void>(`/purchases/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getSales: () => request<SaleInvoice[]>('/sales'),
  createSale: (payload: SalePayload) =>
    request<SaleInvoice>(
      '/sales',
      body({
        customerId: payload.customerId,
        customerName: payload.customerName,
        items: payload.items.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
        discount: payload.discount,
        vat: payload.vat,
        paymentMethod: payload.paymentMethod,
      })
    ),
  markSalePaid: (id: string) =>
    request<SaleInvoice>(`/sales/${encodeURIComponent(id)}/mark-paid`, { method: 'POST' }),

  getDues: () => request<DuePaymentRecord[]>('/dues'),
  createDuePayment: (payload: {
    customerId: string;
    amount: number;
    method: DuePaymentMethod;
    note: string;
  }) => request<DuePaymentRecord>('/dues', body(payload)),

  getInvoiceSettings: () => request<StoreSettings>('/invoice-settings'),
  getSettings: () => request<StoreSettings>('/settings'),
  updateSettings: (settings: StoreSettings) =>
    request<StoreSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  getUsers: () => request<StaffUser[]>('/users'),
  createUser: (user: Omit<StaffUser, 'id' | 'lastActive'>) =>
    request<StaffUser>('/users', body({ ...user, role: user.role.toLowerCase() })),
  updateUser: (user: StaffUser) =>
    request<StaffUser>(`/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...user, role: user.role.toLowerCase() }),
    }),
  toggleUser: (id: string) =>
    request<StaffUser>(`/users/${encodeURIComponent(id)}/toggle`, { method: 'POST' }),
  deleteUser: (id: string) =>
    request<void>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const publicApi = {
  getMenu: (token: string) =>
    publicRequest<PublicMenu>(`/menu?token=${encodeURIComponent(token)}`),
  placeOrder: (token: string, items: PublicCartLine[]) =>
    publicRequest<PublicOrderResult>(
      '/orders',
      body({
        token,
        items: items.map((line) => ({
          menuItemId: line.item.id,
          ...(line.variant ? { variantId: line.variant.id } : {}),
          quantity: line.quantity,
          note: line.note,
        })),
      })
    ),
  getOrderStatus: (token: string, orderId: string) =>
    publicRequest<PublicOrderStatusResult>(
      `/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`
    ),
};
