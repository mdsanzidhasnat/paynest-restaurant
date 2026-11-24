import type {
  Category,
  Customer,
  DailySalesPoint,
  DuePaymentRecord,
  Product,
  PurchaseOrder,
  SaleInvoice,
  StaffRole,
  StoreSettings,
  Supplier,
} from '../src/types/pos.ts';
import { permissionsForRole, toUiRole, type Role } from './permissions.ts';

// better-sqlite3 returns untyped rows; all values are validated before mapping.
type Row = any;

export function mapUser(row: Row) {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    role: toUiRole(row.role as Role),
    active: Boolean(row.active),
    avatar: row.avatar ?? undefined,
    lastActive: row.last_active as string,
    permissions: permissionsForRole(row.role as Role),
  };
}

export function mapProduct(row: Row): Product {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    name: row.name,
    category: row.category,
    brand: row.brand ?? undefined,
    unit: row.unit,
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    stock: row.stock,
    lowStockThreshold: row.low_stock_threshold,
    soldToday: row.sold_today,
    soldThisWeek: row.sold_this_week,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
  };
}

export function mapCategory(row: Row): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    revenueShare: row.revenue_share,
    revenueAmount: row.revenue_amount,
  };
}

export function mapCustomer(row: Row): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    area: row.area,
    totalOrders: row.total_orders,
    totalSpent: row.total_spent,
    dueBalance: row.due_balance,
    lastVisit: row.last_visit,
    lastOrderDate: row.last_order_date,
    isNewThisMonth: Boolean(row.is_new_this_month),
  };
}

export function mapSupplier(row: Row): Supplier {
  return {
    id: row.id,
    company: row.company,
    contactName: row.contact_name,
    phone: row.phone,
    category: row.category,
    payableAmount: row.payable_amount,
    lastSupply: row.last_supply,
  };
}

export function mapPurchase(row: Row): PurchaseOrder {
  return {
    id: row.id,
    poNumber: row.po_number,
    supplierName: row.supplier_name,
    itemsSummary: row.items_summary,
    itemCount: row.item_count,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    status: row.status,
    date: row.purchase_date,
  };
}

export function mapSale(row: Row, items: Row[]): SaleInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id ?? 'walk-in',
    customerName: row.customer_name,
    items: items.map((item) => ({
      productId: item.product_id ?? '',
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      costPrice: item.cost_price,
    })),
    subtotal: row.subtotal,
    discount: row.discount,
    vat: row.vat,
    amount: row.amount,
    profit: row.profit,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    time: row.sale_time,
    date: row.sale_date,
  };
}

export function mapDuePayment(row: Row): DuePaymentRecord {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    customerId: row.customer_id ?? '',
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    amount: row.amount,
    remainingDue: row.remaining_due,
    method: row.method,
    note: row.note,
    dateTime: row.date_time,
  };
}

export function mapSettings(row: Row): StoreSettings {
  let paymentMethods: StoreSettings['paymentMethods'];
  try {
    paymentMethods = JSON.parse(row.payment_methods || '{}');
  } catch {
    paymentMethods = undefined;
  }
  return {
    storeName: row.store_name,
    branchName: row.branch_name,
    phone: row.phone,
    email: row.email || undefined,
    address: row.address,
    currencySymbol: row.currency_symbol,
    vatPercent: row.vat_percent,
    taxInclusive: Boolean(row.tax_inclusive),
    lowStockDefault: row.low_stock_default,
    invoicePrefix: row.invoice_prefix,
    paperSize: row.paper_size,
    showQrCode: Boolean(row.show_qr_code),
    showPaidStamp: Boolean(row.show_paid_stamp),
    receiptFooter: row.receipt_footer,
    paymentMethods,
  };
}

export function mapDailySales(row: Row): DailySalesPoint {
  return {
    day: row.day,
    dateLabel: row.date_label,
    sales: row.sales,
    profit: row.profit,
    orders: row.orders,
  };
}

export const UI_ROLES: StaffRole[] = ['Admin', 'Manager', 'Cashier'];
