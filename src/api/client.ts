import type {
  BillSplit,
  BillView,
  DashboardSummary,
  DailySalesRow,
  Ingredient,
  InvoiceSettings,
  KitchenTicket,
  MenuCategory,
  MenuItem,
  MenuVariant,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  PaymentMethodKey,
  PaymentRecord,
  PublicCartLine,
  PublicMenu,
  PublicOrderResult,
  PublicOrderStatusResult,
  RecipeLine,
  RestaurantFloor,
  RestaurantOrder,
  RestaurantRole,
  RestaurantSettings,
  RestaurantTable,
  StockMovement,
  TableQr,
  TableStatus,
  TableTurnoverRow,
  TopItemRow,
} from '../types/pos';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
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
let forbiddenHandler: ((message: string) => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function setForbiddenHandler(handler: ((message: string) => void) | null): void {
  forbiddenHandler = handler;
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    return String((payload as { error: unknown }).error);
  }
  return `Request failed (${status})`;
}

async function parseResponse<T>(response: Response): Promise<T> {
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
    const message = errorMessage(payload, response.status);
    if (response.status === 403) forbiddenHandler?.(message);
    throw new ApiError(response.status, message);
  }
  return payload as T;
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
  if (response.status === 401) unauthorizedHandler?.();
  return parseResponse<T>(response);
}

function body(data: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(data) };
}

function put(data: unknown): RequestInit {
  return { method: 'PUT', body: JSON.stringify(data) };
}

function patch(data: unknown): RequestInit {
  return { method: 'PATCH', body: JSON.stringify(data) };
}

/** Guest calls never touch the staff session or its 401 handler. */
async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/public${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return parseResponse<T>(response);
}

type Raw = Record<string, any>;

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const number = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const flag = (value: unknown): boolean => value === 1 || value === true;

function mapTable(row: Raw): RestaurantTable {
  return {
    id: text(row.id),
    floorId: text(row.floor_id),
    floorName: text(row.floor_name),
    number: text(row.number),
    seats: number(row.seats, 2),
    x: number(row.x),
    y: number(row.y),
    shape: row.shape === 'square' ? 'square' : 'round',
    status: (['free', 'occupied', 'bill_pending'].includes(row.status)
      ? row.status
      : 'free') as TableStatus,
    qrSecretVersion: number(row.qr_secret_version, 1),
  };
}

function mapFloor(row: Raw): RestaurantFloor {
  return {
    id: text(row.id),
    name: text(row.name),
    sortOrder: number(row.sort_order),
    tables: Array.isArray(row.tables) ? row.tables.map(mapTable) : [],
  };
}

function mapCategory(row: Raw): MenuCategory {
  return {
    id: text(row.id),
    name: text(row.name),
    description: text(row.description),
    color: text(row.color, '#4F46E5'),
    sortOrder: number(row.sort_order),
    active: flag(row.active),
  };
}

function mapVariant(row: Raw): MenuVariant {
  return {
    id: text(row.id),
    menuItemId: text(row.menu_item_id),
    name: text(row.name),
    price: number(row.price),
    available: flag(row.available),
    sortOrder: number(row.sort_order),
  };
}

function mapMenuItem(row: Raw): MenuItem {
  return {
    id: text(row.id),
    categoryId: text(row.category_id),
    name: text(row.name),
    description: text(row.description),
    image: typeof row.image === 'string' ? row.image : null,
    price: number(row.price),
    available: flag(row.available),
    prepStation: ['grill', 'beverage', 'dessert'].includes(row.prep_station)
      ? row.prep_station
      : 'kitchen',
    sortOrder: number(row.sort_order),
    variants: Array.isArray(row.variants) ? row.variants.map(mapVariant) : [],
  };
}

function mapOrderItem(row: Raw): OrderItem {
  return {
    id: text(row.id),
    orderId: text(row.order_id),
    menuItemId: text(row.menu_item_id),
    variantId: typeof row.variant_id === 'string' ? row.variant_id : null,
    name: text(row.name_snapshot),
    variantName: text(row.variant_name_snapshot),
    quantity: number(row.quantity),
    notes: text(row.notes),
    status: (['new', 'preparing', 'ready', 'served', 'cancelled'].includes(row.status)
      ? row.status
      : 'new') as OrderItemStatus,
    unitPrice: number(row.unit_price),
    lineTotal: number(row.line_total),
    createdAt: text(row.created_at),
  };
}

function mapPayment(row: Raw): PaymentRecord {
  return {
    id: text(row.id),
    orderId: text(row.order_id),
    method: (['Cash', 'bKash', 'Nagad', 'Card'].includes(row.method)
      ? row.method
      : 'Cash') as PaymentMethodKey,
    amount: number(row.amount),
    reference: text(row.reference),
    recordedBy: text(row.recorded_by),
    createdAt: text(row.created_at),
  };
}

function mapSplit(row: Raw): BillSplit {
  return {
    id: text(row.id),
    orderId: text(row.order_id),
    label: text(row.label),
    amount: number(row.amount),
    method: ['Cash', 'bKash', 'Nagad', 'Card'].includes(row.method)
      ? (row.method as PaymentMethodKey)
      : null,
    reference: text(row.reference),
    paidAt: typeof row.paid_at === 'string' ? row.paid_at : null,
  };
}

function mapOrder(row: Raw): RestaurantOrder {
  return {
    id: text(row.id),
    orderNumber: text(row.order_number),
    billNumber: typeof row.bill_number === 'string' ? row.bill_number : null,
    tableId: text(row.table_id),
    source: row.source === 'qr' ? 'qr' : 'waiter',
    status: (['pending_confirmation', 'new', 'preparing', 'ready', 'served', 'closed'].includes(
      row.status
    )
      ? row.status
      : 'new') as OrderStatus,
    openedBy: typeof row.opened_by === 'string' ? row.opened_by : null,
    guestCount: number(row.guest_count),
    notes: text(row.notes),
    subtotal: number(row.subtotal),
    discount: number(row.discount),
    vatAmount: number(row.vat_amount),
    serviceCharge: number(row.service_charge),
    total: number(row.total),
    paymentStatus: ['paid', 'void'].includes(row.payment_status)
      ? row.payment_status
      : 'unpaid',
    paymentMethod: ['Cash', 'bKash', 'Nagad', 'Card'].includes(row.payment_method)
      ? (row.payment_method as PaymentMethodKey)
      : null,
    createdAt: text(row.created_at),
    openedAt: text(row.opened_at),
    closedAt: typeof row.closed_at === 'string' ? row.closed_at : null,
    items: Array.isArray(row.items) ? row.items.map(mapOrderItem) : [],
    payments: Array.isArray(row.payments) ? row.payments.map(mapPayment) : [],
    splits: Array.isArray(row.splits) ? row.splits.map(mapSplit) : [],
  };
}

function mapBill(row: Raw): BillView {
  const settings: InvoiceSettings = {
    restaurantName: text(row.settings?.restaurant_name, 'Restaurant'),
    phone: text(row.settings?.phone),
    email: text(row.settings?.email),
    address: text(row.settings?.address),
    currencySymbol: text(row.settings?.currency_symbol, '৳'),
    vatPercent: number(row.settings?.vat_percent),
    serviceChargePercent: number(row.settings?.service_charge_percent),
    invoicePrefix: text(row.settings?.invoice_prefix, 'INV-'),
    paperSize: row.settings?.paper_size === '80mm' ? '80mm' : 'A4',
    receiptFooter: text(row.settings?.receipt_footer),
  };
  return {
    order: mapOrder(row.order),
    lines: Array.isArray(row.lines) ? row.lines.map(mapOrderItem) : [],
    totals: {
      subtotal: number(row.totals?.subtotal),
      discount: number(row.totals?.discount),
      vatAmount: number(row.totals?.vat_amount ?? row.totals?.vatAmount),
      serviceCharge: number(row.totals?.service_charge ?? row.totals?.serviceCharge),
      total: number(row.totals?.total),
    },
    paid: number(row.paid),
    due: number(row.due),
    payments: Array.isArray(row.payments) ? row.payments.map(mapPayment) : [],
    splits: Array.isArray(row.splits) ? row.splits.map(mapSplit) : [],
    settings,
  };
}

function mapKitchenTicket(row: Raw): KitchenTicket {
  return {
    ...mapOrderItem(row),
    orderNumber: text(row.order_number),
    tableId: text(row.table_id),
    tableNumber: text(row.table_number),
    floorName: text(row.floor_name),
    ageMinutes: number(row.age_minutes),
  };
}

function mapIngredient(row: Raw): Ingredient {
  return {
    id: text(row.id),
    name: text(row.name),
    unit: text(row.unit, 'pcs'),
    stock: number(row.stock),
    lowStockThreshold: number(row.low_stock_threshold),
    lowStock: flag(row.low_stock) || number(row.stock) <= number(row.low_stock_threshold),
    unitCost: number(row.unit_cost),
  };
}

function mapMovement(row: Raw): StockMovement {
  return {
    id: number(row.id),
    ingredientId: text(row.ingredient_id),
    ingredientName: text(row.ingredient_name),
    quantity: number(row.quantity),
    reason: ['served', 'manual', 'waste', 'correction'].includes(row.reason)
      ? row.reason
      : 'manual',
    note: text(row.note),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    createdAt: text(row.created_at),
  };
}

function mapRecipeLine(row: Raw): RecipeLine {
  return {
    menuItemId: text(row.menu_item_id),
    ingredientId: text(row.ingredient_id),
    ingredientName: text(row.name),
    unit: text(row.unit),
    quantity: number(row.quantity),
    stock: number(row.stock),
    lowStockThreshold: number(row.low_stock_threshold),
  };
}

function mapSettings(row: Raw): RestaurantSettings {
  return {
    restaurantName: text(row.restaurant_name, 'Restaurant'),
    phone: text(row.phone),
    email: text(row.email),
    address: text(row.address),
    currencySymbol: text(row.currency_symbol, '৳'),
    vatPercent: number(row.vat_percent),
    serviceChargePercent: number(row.service_charge_percent),
    invoicePrefix: text(row.invoice_prefix, 'INV-'),
    paperSize: row.paper_size === '80mm' ? '80mm' : 'A4',
    receiptFooter: text(row.receipt_footer),
    lowStockDefault: number(row.low_stock_default),
    autoConfirmPublicOrders: flag(row.autoConfirmPublicOrders),
  };
}

function mapDailySales(row: Raw): DailySalesRow {
  return {
    salesDate: text(row.sales_date),
    day: text(row.day),
    dateLabel: text(row.date_label),
    sales: number(row.sales),
    orders: number(row.orders),
    vat: number(row.vat),
    serviceCharge: number(row.service_charge),
  };
}

function mapTopItem(row: Raw): TopItemRow {
  return {
    menuItemId: text(row.menu_item_id),
    name: text(row.name),
    quantity: number(row.quantity),
    revenue: number(row.revenue),
    orders: number(row.orders),
  };
}

function mapTurnover(row: Raw): TableTurnoverRow {
  return {
    tableId: text(row.table_id),
    tableNumber: text(row.table_number),
    floor: text(row.floor),
    completedOrders: number(row.completed_orders),
    revenue: number(row.revenue),
  };
}

export interface TableInput {
  floorId: string;
  number: string;
  seats?: number;
  x?: number;
  y?: number;
  shape?: 'round' | 'square';
}

export interface MenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  image?: string | null;
  price: number;
  prepStation?: MenuItem['prepStation'];
  sortOrder?: number;
  available?: boolean;
}

export interface MenuVariantInput {
  menuItemId: string;
  name: string;
  price: number;
  available?: boolean;
  sortOrder?: number;
}

export interface DiscountInput {
  type: 'none' | 'fixed' | 'percent';
  value: number;
}

export interface PaymentInput {
  method: PaymentMethodKey;
  amount: number;
  reference?: string;
  splitId?: string;
}

export interface InvoiceView extends BillView {
  invoiceNumber: string | null;
  issuedAt: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthUser>('/auth/login', body({ email, password })),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<AuthUser>('/auth/me'),

  getTableMap: async () => (await request<Raw[]>('/tables/map')).map(mapFloor),
  getTables: async () => (await request<Raw[]>('/tables')).map(mapTable),
  getTable: async (id: string) => mapTable(await request<Raw>(`/tables/${encodeURIComponent(id)}`)),
  createTable: async (input: TableInput) =>
    mapTable(await request<Raw>('/tables', body(input))),
  updateTable: async (id: string, input: Partial<TableInput>) =>
    mapTable(await request<Raw>(`/tables/${encodeURIComponent(id)}`, put(input))),
  getTableQr: (tableId: string) =>
    request<TableQr>(`/tables/${encodeURIComponent(tableId)}/qr`),
  rotateTableQr: (tableId: string) =>
    request<TableQr>(`/tables/${encodeURIComponent(tableId)}/qr/rotate`, body({})),

  getCategories: async () => (await request<Raw[]>('/menu/categories')).map(mapCategory),
  createCategory: async (input: {
    name: string;
    description?: string;
    color?: string;
    sortOrder?: number;
    active?: boolean;
  }) => mapCategory(await request<Raw>('/menu/categories', body(input))),
  updateCategory: async (id: string, input: Partial<{ name: string; description: string; color: string; sortOrder: number; active: boolean }>) =>
    mapCategory(await request<Raw>(`/menu/categories/${encodeURIComponent(id)}`, put(input))),
  deleteCategory: (id: string) =>
    request<void>(`/menu/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getMenuItems: async (categoryId?: string) =>
    (await request<Raw[]>(`/menu${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''}`)).map(
      mapMenuItem
    ),
  getMenuItem: async (id: string) => mapMenuItem(await request<Raw>(`/menu/${encodeURIComponent(id)}`)),
  createMenuItem: async (input: MenuItemInput) =>
    mapMenuItem(await request<Raw>('/menu', body(input))),
  updateMenuItem: async (id: string, input: Partial<MenuItemInput>) =>
    mapMenuItem(await request<Raw>(`/menu/${encodeURIComponent(id)}`, put(input))),
  toggleMenuItemAvailability: async (id: string, available: boolean) =>
    mapMenuItem(
      await request<Raw>(`/menu/${encodeURIComponent(id)}/availability`, patch({ available }))
    ),
  deleteMenuItem: (id: string) =>
    request<void>(`/menu/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getVariants: async () => (await request<Raw[]>('/menu/variants')).map(mapVariant),
  createVariant: async (input: MenuVariantInput) =>
    mapVariant(await request<Raw>('/menu/variants', body(input))),
  updateVariant: async (id: string, input: Partial<Omit<MenuVariantInput, 'menuItemId'>>) =>
    mapVariant(await request<Raw>(`/menu/variants/${encodeURIComponent(id)}`, put(input))),
  deleteVariant: (id: string) =>
    request<void>(`/menu/variants/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getOrders: async (filters: { status?: OrderStatus; tableId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.tableId) params.set('tableId', filters.tableId);
    const serialized = params.toString();
    const query = serialized ? `?${serialized}` : '';
    return (await request<Raw[]>(`/orders${query}`)).map(mapOrder);
  },
  getOrder: async (id: string) => mapOrder(await request<Raw>(`/orders/${encodeURIComponent(id)}`)),
  createOrder: async (input: { tableId: string; guestCount?: number; notes?: string }) =>
    mapOrder(await request<Raw>('/orders', body(input))),
  confirmOrder: async (id: string) =>
    mapOrder(await request<Raw>(`/orders/${encodeURIComponent(id)}/confirm`, body({}))),
  addOrderItem: async (
    orderId: string,
    input: { menuItemId: string; variantId?: string; quantity: number; notes?: string }
  ) => mapOrder(await request<Raw>(`/orders/${encodeURIComponent(orderId)}/items`, body(input))),
  updateItemNotes: async (itemId: string, notes: string) =>
    mapOrder(await request<Raw>(`/orders/items/${encodeURIComponent(itemId)}/notes`, patch({ notes }))),
  removeOrderItem: async (itemId: string) =>
    mapOrder(await request<Raw>(`/orders/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })),
  transferOrder: async (orderId: string, toTableId: string) =>
    mapOrder(
      (
        await request<{ order: Raw }>(
          `/orders/${encodeURIComponent(orderId)}/transfer`,
          body({ toTableId })
        )
      ).order
    ),
  serveItem: async (orderId: string, itemId: string) =>
    mapOrder(
      (
        await request<{ order: Raw }>(
          `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/serve`,
          body({})
        )
      ).order
    ),
  cancelOrder: async (id: string, reason: string) =>
    mapOrder(await request<Raw>(`/orders/${encodeURIComponent(id)}/cancel`, body({ reason }))),

  getKitchenTickets: async () =>
    (await request<Raw[]>('/kitchen/tickets')).map(mapKitchenTicket),
  setKitchenItemStatus: (itemId: string, status: 'new' | 'preparing' | 'ready') =>
    request<Raw>(`/kitchen/items/${encodeURIComponent(itemId)}/status`, patch({ status })),

  getBill: async (orderId: string) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}`)),
  requestBill: async (orderId: string) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/request`, body({}))),
  setDiscount: async (orderId: string, input: DiscountInput) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/discount`, body(input))),
  createSplits: async (orderId: string, input: { mode: 'equal'; parts: number } | { mode: 'items' }) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/splits`, body(input))),
  recordPayment: async (orderId: string, input: PaymentInput) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/payments`, body(input))),
  closeBill: async (orderId: string) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/close`, body({}))),
  voidBill: async (orderId: string) =>
    mapBill(await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/void`, body({}))),
  getInvoice: async (orderId: string): Promise<InvoiceView> => {
    const row = await request<Raw>(`/bills/orders/${encodeURIComponent(orderId)}/invoice`);
    return {
      ...mapBill(row),
      invoiceNumber: typeof row.invoiceNumber === 'string' ? row.invoiceNumber : null,
      issuedAt: text(row.issuedAt),
    };
  },

  getIngredients: async () => (await request<Raw[]>('/inventory/ingredients')).map(mapIngredient),
  getLowStockIngredients: async () =>
    (await request<Raw[]>('/inventory/low-stock')).map(mapIngredient),
  getStockMovements: async () => (await request<Raw[]>('/inventory/movements')).map(mapMovement),
  createIngredient: async (input: {
    name: string;
    unit?: string;
    stock?: number;
    lowStockThreshold?: number;
    unitCost?: number;
  }) => mapIngredient(await request<Raw>('/inventory/ingredients', body(input))),
  updateIngredient: async (id: string, input: Record<string, unknown>) =>
    mapIngredient(await request<Raw>(`/inventory/ingredients/${encodeURIComponent(id)}`, put(input))),
  adjustStock: async (id: string, quantity: number, note: string) =>
    mapIngredient(
      await request<Raw>(`/inventory/ingredients/${encodeURIComponent(id)}/adjust`, body({ quantity, note }))
    ),
  getRecipe: async (menuItemId: string) =>
    (await request<Raw[]>(`/inventory/recipes/${encodeURIComponent(menuItemId)}`)).map(mapRecipeLine),
  saveRecipe: async (menuItemId: string, lines: { ingredientId: string; quantity: number }[]) =>
    (
      await request<Raw[]>(
        `/inventory/recipes/${encodeURIComponent(menuItemId)}`,
        put({ lines })
      )
    ).map(mapRecipeLine),

  getDashboard: () => request<DashboardSummary>('/reports/dashboard'),
  getDailySales: async () => (await request<Raw[]>('/reports/daily-sales')).map(mapDailySales),
  getTopItems: async () => (await request<Raw[]>('/reports/top-items')).map(mapTopItem),
  getTableTurnover: async () => (await request<Raw[]>('/reports/table-turnover')).map(mapTurnover),
  getLowStockSummary: () =>
    request<{ count: number; items: Raw[] }>('/reports/low-stock').then((result) => ({
      count: result.count,
      items: result.items.map(mapIngredient),
    })),

  getUsers: () => request<AuthUser[]>('/users'),
  createUser: (input: {
    name: string;
    email: string;
    phone: string;
    role: RestaurantRole;
    active?: boolean;
    password: string;
  }) => request<AuthUser>('/users', body(input)),
  updateUser: (id: string, input: {
    name: string;
    email: string;
    phone: string;
    role: RestaurantRole;
    active?: boolean;
    password?: string;
  }) => request<AuthUser>(`/users/${encodeURIComponent(id)}`, put(input)),
  toggleUser: (id: string) =>
    request<AuthUser>(`/users/${encodeURIComponent(id)}/toggle`, body({})),
  deleteUser: (id: string) =>
    request<void>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getSettings: async () => mapSettings(await request<Raw>('/settings')),
  updateSettings: async (input: RestaurantSettings) =>
    mapSettings(
      await request<Raw>('/settings', put({
        restaurantName: input.restaurantName,
        phone: input.phone,
        email: input.email || undefined,
        address: input.address,
        currencySymbol: input.currencySymbol,
        vatPercent: input.vatPercent,
        serviceChargePercent: input.serviceChargePercent,
        invoicePrefix: input.invoicePrefix,
        paperSize: input.paperSize,
        receiptFooter: input.receiptFooter,
        lowStockDefault: input.lowStockDefault,
        autoConfirmPublicOrders: input.autoConfirmPublicOrders,
      }))
    ),
  getInvoiceSettings: async (): Promise<InvoiceSettings> => {
    const row = await request<Raw>('/settings/invoice');
    return {
      restaurantName: text(row.restaurantName, 'Restaurant'),
      phone: text(row.phone),
      email: text(row.email),
      address: text(row.address),
      currencySymbol: text(row.currencySymbol, '৳'),
      vatPercent: number(row.vatPercent),
      serviceChargePercent: number(row.serviceChargePercent),
      invoicePrefix: text(row.invoicePrefix, 'INV-'),
      paperSize: row.paperSize === '80mm' ? '80mm' : 'A4',
      receiptFooter: text(row.receiptFooter),
    };
  },
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
