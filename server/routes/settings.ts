import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { now } from '../http.ts';
import { requirePermission } from '../middleware.ts';
import { parse } from '../validate.ts';

export const settingsRouter = Router();

type Row = Record<string, any>;

const settingsInput = z.object({
  restaurantName: z.string().trim().min(1),
  phone: z.string().trim().default(''),
  email: z.string().trim().email().optional(),
  address: z.string().trim().default(''),
  currencySymbol: z.string().trim().min(1),
  vatPercent: z.number().min(0).max(100),
  serviceChargePercent: z.number().min(0).max(100),
  invoicePrefix: z.string().trim().min(1),
  paperSize: z.enum(['A4', '80mm']),
  receiptFooter: z.string().trim().default(''),
  lowStockDefault: z.number().nonnegative(),
  // Optional so legacy settings forms cannot silently disable this flag.
  autoConfirmPublicOrders: z.boolean().optional(),
});

function settingsRow(): Row {
  return getDb().prepare('SELECT * FROM settings WHERE id = 1').get() as Row;
}

function settingsResponse(): Row {
  const row = settingsRow();
  return { ...row, autoConfirmPublicOrders: row.auto_confirm_public_orders === 1 };
}

settingsRouter.get('/', requirePermission('settings:read'), (_req, res) => {
  res.json(settingsResponse());
});

settingsRouter.put('/', requirePermission('settings:write'), (req, res) => {
  const input = parse(settingsInput, req.body);
  getDb()
    .prepare(`
      UPDATE settings SET
        restaurant_name = @restaurant_name, phone = @phone, email = @email,
        address = @address, currency_symbol = @currency_symbol, vat_percent = @vat_percent,
        service_charge_percent = @service_charge_percent, invoice_prefix = @invoice_prefix,
        paper_size = @paper_size, receipt_footer = @receipt_footer,
        low_stock_default = @low_stock_default,
        auto_confirm_public_orders = COALESCE(@auto_confirm_public_orders, auto_confirm_public_orders),
        updated_at = @updated_at
      WHERE id = 1
    `)
    .run({
      restaurant_name: input.restaurantName,
      phone: input.phone,
      email: input.email ?? '',
      address: input.address,
      currency_symbol: input.currencySymbol,
      vat_percent: input.vatPercent,
      service_charge_percent: input.serviceChargePercent,
      invoice_prefix: input.invoicePrefix,
      paper_size: input.paperSize,
      receipt_footer: input.receiptFooter,
      low_stock_default: input.lowStockDefault,
      auto_confirm_public_orders:
        input.autoConfirmPublicOrders === undefined ? null : input.autoConfirmPublicOrders ? 1 : 0,
      updated_at: now(),
    });
  res.json(settingsResponse());
});

settingsRouter.get('/invoice', requirePermission('invoice-settings:read'), (_req, res) => {
  const row = settingsRow();
  res.json({
    restaurantName: row.restaurant_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    currencySymbol: row.currency_symbol,
    vatPercent: row.vat_percent,
    serviceChargePercent: row.service_charge_percent,
    invoicePrefix: row.invoice_prefix,
    paperSize: row.paper_size,
    receiptFooter: row.receipt_footer,
  });
});
