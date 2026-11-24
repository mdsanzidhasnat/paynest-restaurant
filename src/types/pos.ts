export type NavSection =
  | 'dashboard'
  | 'tables'
  | 'waiter-order'
  | 'kitchen'
  | 'menu'
  | 'billing'
  | 'inventory'
  | 'reports'
  | 'users'
  | 'settings'
  | 'table-qr';

/** Public QR ordering types. Prices are INTEGER minor units (paisa). */

export interface PublicVariant {
  id: string;
  name: string;
  price: number;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string;
  image: string | null;
  price: number;
  variants: PublicVariant[];
}

export interface PublicCategory {
  id: string;
  name: string;
  description: string;
  items: PublicMenuItem[];
}

export interface PublicMenu {
  restaurantName: string;
  table: { label: string };
  categories: PublicCategory[];
}

export type PublicOrderStatus =
  | 'pending_confirmation'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'closed';

export interface PublicOrderResult {
  orderId: string;
  status: PublicOrderStatus;
  tableLabel: string;
}

export interface PublicOrderLineStatus {
  id: string;
  name: string;
  status: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export interface PublicOrderStatusResult extends PublicOrderResult {
  items: PublicOrderLineStatus[];
}

export interface PublicCartLine {
  key: string;
  item: PublicMenuItem;
  variant: PublicVariant | null;
  quantity: number;
  note: string;
}

export interface StaffTable {
  id: string;
  floor_id: string;
  number: string;
  floor_name: string;
  status: 'free' | 'occupied' | 'bill_pending';
  qr_secret_version: number;
}

export interface TableQr {
  tableId: string;
  tableNumber: string;
  version: number;
  token: string;
  path: string;
  url: string;
}

/** Restaurant staff screens. All money values are INTEGER minor units (paisa). */

export type RestaurantRole = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';
export type TableStatus = 'free' | 'occupied' | 'bill_pending';
export type OrderStatus =
  | 'pending_confirmation'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'closed';
export type OrderItemStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type PaymentMethodKey = 'Cash' | 'bKash' | 'Nagad' | 'Card';
export type PrepStation = 'kitchen' | 'grill' | 'beverage' | 'dessert';

export interface RestaurantTable {
  id: string;
  floorId: string;
  floorName: string;
  number: string;
  seats: number;
  x: number;
  y: number;
  shape: 'round' | 'square';
  status: TableStatus;
  qrSecretVersion: number;
}

export interface RestaurantFloor {
  id: string;
  name: string;
  sortOrder: number;
  tables: RestaurantTable[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
  active: boolean;
}

export interface MenuVariant {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  available: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  image: string | null;
  price: number;
  available: boolean;
  prepStation: PrepStation;
  sortOrder: number;
  variants: MenuVariant[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  variantId: string | null;
  name: string;
  variantName: string;
  quantity: number;
  notes: string;
  status: OrderItemStatus;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  method: PaymentMethodKey;
  amount: number;
  reference: string;
  recordedBy: string;
  createdAt: string;
}

export interface BillSplit {
  id: string;
  orderId: string;
  label: string;
  amount: number;
  method: PaymentMethodKey | null;
  reference: string;
  paidAt: string | null;
}

export interface RestaurantOrder {
  id: string;
  orderNumber: string;
  billNumber: string | null;
  tableId: string;
  source: 'qr' | 'waiter';
  status: OrderStatus;
  openedBy: string | null;
  guestCount: number;
  notes: string;
  subtotal: number;
  discount: number;
  vatAmount: number;
  serviceCharge: number;
  total: number;
  paymentStatus: 'unpaid' | 'paid' | 'void';
  paymentMethod: PaymentMethodKey | null;
  createdAt: string;
  openedAt: string;
  closedAt: string | null;
  items: OrderItem[];
  payments: PaymentRecord[];
  splits: BillSplit[];
}

export interface ServerTotals {
  subtotal: number;
  discount: number;
  vatAmount: number;
  serviceCharge: number;
  total: number;
}

export interface InvoiceSettings {
  restaurantName: string;
  phone: string;
  email: string;
  address: string;
  currencySymbol: string;
  vatPercent: number;
  serviceChargePercent: number;
  invoicePrefix: string;
  paperSize: 'A4' | '80mm';
  receiptFooter: string;
}

export interface BillView {
  order: RestaurantOrder;
  lines: OrderItem[];
  totals: ServerTotals;
  paid: number;
  due: number;
  payments: PaymentRecord[];
  splits: BillSplit[];
  settings: InvoiceSettings;
}

export interface KitchenTicket extends OrderItem {
  orderNumber: string;
  tableId: string;
  tableNumber: string;
  floorName: string;
  ageMinutes: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  lowStock: boolean;
  unitCost: number;
}

export interface StockMovement {
  id: number;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  reason: 'served' | 'manual' | 'waste' | 'correction';
  note: string;
  createdBy: string | null;
  createdAt: string;
}

export interface RecipeLine {
  menuItemId: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  stock: number;
  lowStockThreshold: number;
}

export interface RestaurantSettings extends InvoiceSettings {
  lowStockDefault: number;
  autoConfirmPublicOrders: boolean;
}

export interface DashboardSummary {
  todaySales: number;
  todayOrders: number;
  weeklyRevenue: number;
  openOrders: number;
  occupiedTables: number;
  lowStockCount: number;
}

export interface DailySalesRow {
  salesDate: string;
  day: string;
  dateLabel: string;
  sales: number;
  orders: number;
  vat: number;
  serviceCharge: number;
}

export interface TopItemRow {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export interface TableTurnoverRow {
  tableId: string;
  tableNumber: string;
  floor: string;
  completedOrders: number;
  revenue: number;
}

export interface StaffUserInput {
  name: string;
  email: string;
  phone: string;
  role: RestaurantRole;
  active?: boolean;
  password?: string;
}
