import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { mapDailySales, mapSettings, mapUser } from '../mappers.ts';
import { requirePermission, requireRole, type AuthRequest } from '../middleware.ts';
import { ROLES } from '../permissions.ts';
import { parse } from '../validate.ts';

export const dashboardRouter = Router();
export const reportsRouter = Router();
export const settingsRouter = Router();
export const invoiceSettingsRouter = Router();
export const usersRouter = Router();

function dashboardData() {
  const db = getDb();
  const rows = db
    .prepare('SELECT day, date_label, sales, profit, orders, sales_date FROM daily_sales ORDER BY sales_date ASC')
    .all() as Record<string, any>[];
  const weekly = rows.slice(-7);
  const today = weekly[weekly.length - 1];
  const lowStock = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE stock <= low_stock_threshold')
    .get() as { count: number };
  const totalRevenue = weekly.reduce((sum, row) => sum + row.sales, 0);
  const totalProfit = weekly.reduce((sum, row) => sum + row.profit, 0);
  return {
    todaySales: today?.sales ?? 0,
    totalOrders: today?.orders ?? 0,
    totalProfit: today?.profit ?? 0,
    lowStockCount: lowStock.count,
    weeklySales: weekly.map(mapDailySales),
    totalRevenue,
    netProfit: totalProfit,
  };
}

dashboardRouter.get('/', requirePermission('dashboard:read'), (_req, res) => {
  res.json(dashboardData());
});

reportsRouter.get('/', requirePermission('reports:read'), (_req, res) => {
  const db = getDb();
  const data = dashboardData();
  const categories = db
    .prepare('SELECT name, revenue_share, revenue_amount FROM categories ORDER BY revenue_amount DESC')
    .all() as Record<string, any>[];
  res.json({
    ...data,
    categories: categories.map((row) => ({
      name: row.name,
      revenueShare: row.revenue_share,
      revenueAmount: row.revenue_amount,
    })),
    totalExpense: Math.max(data.totalRevenue - data.netProfit, 0),
  });
});

const settingsInput = z.object({
  storeName: z.string().trim().min(1),
  branchName: z.string().trim().default(''),
  phone: z.string().trim().default(''),
  email: z.string().trim().email().optional(),
  address: z.string().trim().default(''),
  currencySymbol: z.string().trim().min(1),
  vatPercent: z.number().nonnegative(),
  taxInclusive: z.boolean().optional(),
  lowStockDefault: z.number().int().nonnegative(),
  invoicePrefix: z.string().trim().optional(),
  paperSize: z.enum(['A4', '80mm']).optional(),
  showQrCode: z.boolean().optional(),
  showPaidStamp: z.boolean().optional(),
  receiptFooter: z.string().default(''),
  paymentMethods: z.record(z.string(), z.unknown()).optional(),
});

settingsRouter.get('/', requirePermission('settings:read'), (_req, res) => {
  const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(mapSettings(row as Record<string, any>));
});

settingsRouter.put('/', requirePermission('settings:write'), (req, res) => {
  const input = parse(settingsInput, req.body);
  getDb()
    .prepare(`
      UPDATE settings SET
        store_name = @store_name, branch_name = @branch_name, phone = @phone, email = @email,
        address = @address, currency_symbol = @currency_symbol, vat_percent = @vat_percent,
        tax_inclusive = @tax_inclusive, low_stock_default = @low_stock_default,
        invoice_prefix = @invoice_prefix, paper_size = @paper_size, show_qr_code = @show_qr_code,
        show_paid_stamp = @show_paid_stamp, receipt_footer = @receipt_footer,
        payment_methods = @payment_methods
      WHERE id = 1
    `)
    .run({
      store_name: input.storeName,
      branch_name: input.branchName,
      phone: input.phone,
      email: input.email ?? '',
      address: input.address,
      currency_symbol: input.currencySymbol,
      vat_percent: input.vatPercent,
      tax_inclusive: input.taxInclusive ? 1 : 0,
      low_stock_default: input.lowStockDefault,
      invoice_prefix: input.invoicePrefix ?? '#INV-',
      paper_size: input.paperSize ?? 'A4',
      show_qr_code: input.showQrCode ? 1 : 0,
      show_paid_stamp: input.showPaidStamp ? 1 : 0,
      receipt_footer: input.receiptFooter,
      payment_methods: JSON.stringify(input.paymentMethods ?? {}),
    });
  const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(mapSettings(row as Record<string, any>));
});

// Invoice-facing store branding is readable by every signed-in role so receipts
// render correctly; full store settings remain admin-only.
invoiceSettingsRouter.get('/', requirePermission('invoice-settings:read'), (_req, res) => {
  const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(mapSettings(row as Record<string, any>));
});

const userColumns = 'id, name, email, phone, role, active, avatar, last_active';

interface UserRow extends Record<string, any> {
  id: string;
  role: (typeof ROLES)[number];
  active: number;
  password_hash: string;
}

const userInput = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().default(''),
  // Reject unknown roles with 400 before any database write.
  role: z.enum(ROLES),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

function findUser(id: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT ${userColumns}, password_hash FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
}

function countActiveAdmins(): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1")
      .get() as { count: number }
  ).count;
}

/** A user can never change their own role or deactivate (or delete) themselves. */
function assertNotSelf(req: AuthRequest, id: string): void {
  if (req.auth?.userId === id) {
    throw new HttpError(403, 'You cannot change your own role or status.');
  }
}

/** Keep at least one active admin so the instance can always be administered. */
function assertLastAdmin(target: UserRow, nextRole: string, nextActive: number): void {
  const wasActiveAdmin = target.role === 'admin' && target.active === 1;
  const remainsActiveAdmin = nextRole === 'admin' && nextActive === 1;
  if (wasActiveAdmin && !remainsActiveAdmin && countActiveAdmins() <= 1) {
    throw new HttpError(409, 'The last active admin cannot be removed, demoted or deactivated.');
  }
}

usersRouter.get('/', requirePermission('users:read'), requireRole('admin'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${userColumns} FROM users ORDER BY created_at DESC`).all();
  res.json(rows.map(mapUser));
});

usersRouter.post('/', requirePermission('users:write'), requireRole('admin'), (req, res) => {
  const input = parse(userInput, req.body);
  if (!input.password) {
    throw new HttpError(400, 'password: is required when creating a user');
  }
  const id = `u-${randomUUID()}`;
  getDb()
    .prepare(`
      INSERT INTO users (id, name, email, phone, role, active, avatar, last_active, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 'Just added', ?)
    `)
    .run(
      id,
      input.name,
      input.email.toLowerCase(),
      input.phone,
      input.role,
      input.active === false ? 0 : 1,
      bcrypt.hashSync(input.password, 10)
    );
  const row = getDb().prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(id);
  res.status(201).json(mapUser(row as Record<string, any>));
});

usersRouter.put('/:id', requirePermission('users:write'), requireRole('admin'), (req: AuthRequest, res) => {
  const input = parse(userInput, req.body);
  const existing = findUser(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const nextActive = input.active === false ? 0 : 1;
  assertLastAdmin(existing, input.role, nextActive);
  assertNotSelf(req, existing.id);

  const passwordHash = input.password ? bcrypt.hashSync(input.password, 10) : existing.password_hash;
  getDb()
    .prepare(`
      UPDATE users SET name = ?, email = ?, phone = ?, role = ?, active = ?, password_hash = ? WHERE id = ?
    `)
    .run(
      input.name,
      input.email.toLowerCase(),
      input.phone,
      input.role,
      nextActive,
      passwordHash,
      existing.id
    );
  const row = getDb().prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(existing.id);
  res.json(mapUser(row as Record<string, any>));
});

usersRouter.post('/:id/toggle', requirePermission('users:write'), requireRole('admin'), (req: AuthRequest, res) => {
  const existing = findUser(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const nextActive = existing.active === 1 ? 0 : 1;
  assertLastAdmin(existing, existing.role, nextActive);
  assertNotSelf(req, existing.id);
  getDb().prepare('UPDATE users SET active = ? WHERE id = ?').run(nextActive, existing.id);
  const row = getDb().prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(existing.id);
  res.json(mapUser(row as Record<string, any>));
});

usersRouter.delete('/:id', requirePermission('users:delete'), requireRole('admin'), (req: AuthRequest, res) => {
  const existing = findUser(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  assertLastAdmin(existing, existing.role, 0);
  assertNotSelf(req, existing.id);
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.status(204).end();
});
