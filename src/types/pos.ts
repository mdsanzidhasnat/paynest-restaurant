export type NavSection =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'add-product'
  | 'categories'
  | 'inventory'
  | 'customers'
  | 'due-collection'
  | 'suppliers'
  | 'purchases'
  | 'sales-history'
  | 'invoice-preview'
  | 'reports'
  | 'settings';

export type PaymentStatus = 'Paid' | 'Due';
export type PaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Due';

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  brand?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  lowStockThreshold: number;
  soldToday: number;
  soldThisWeek: number;
  description?: string;
  image?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  revenueShare: number;
  revenueAmount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string;
  totalOrders: number;
  totalSpent: number;
  dueBalance: number;
  lastVisit: string;
  lastOrderDate: string;
  isNewThisMonth?: boolean;
}

export interface Supplier {
  id: string;
  company: string;
  contactName: string;
  phone: string;
  category: string;
  payableAmount: number;
  lastSupply: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  itemsSummary: string;
  itemCount: number;
  totalAmount: number;
  paidAmount: number;
  status: 'Received' | 'Pending';
  date: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  vat: number;
  amount: number;
  profit: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  time: string;
  date: string;
}

export interface DailySalesPoint {
  day: string;
  dateLabel: string;
  sales: number;
  profit: number;
  orders: number;
}

export type StaffRole = 'Admin' | 'Manager' | 'Waiter' | 'Kitchen' | 'Cashier';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  avatar?: string;
  lastActive: string;
}

export interface StoreSettings {
  storeName: string;
  branchName: string;
  phone: string;
  email?: string;
  address: string;
  currencySymbol: string;
  vatPercent: number;
  taxInclusive?: boolean;
  lowStockDefault: number;
  invoicePrefix?: string;
  paperSize?: 'A4' | '80mm';
  showQrCode?: boolean;
  showPaidStamp?: boolean;
  receiptFooter: string;
  paymentMethods?: {
    cash: boolean;
    bkash: boolean;
    nagad: boolean;
    card: boolean;
    due: boolean;
    bkashNumber: string;
    nagadNumber: string;
  };
}

export type DuePaymentMethod = 'Cash' | 'bKash' | 'Nagad';

export interface DuePaymentRecord {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  remainingDue: number;
  method: DuePaymentMethod;
  note: string;
  dateTime: string;
}
