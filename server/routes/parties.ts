import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { calculateDueAmount } from '../../src/utils/billing.ts';
import { getDb } from '../db.ts';
import { mapCustomer, mapDuePayment, mapSupplier } from '../mappers.ts';
import { requirePermission } from '../middleware.ts';
import { parse } from '../validate.ts';

export const customersRouter = Router();
export const suppliersRouter = Router();
export const duesRouter = Router();

const customerColumns =
  'id, name, phone, email, area, total_orders, total_spent, due_balance, last_visit, last_order_date, is_new_this_month';

const customerInput = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().default(''),
  email: z.string().trim().email(),
  area: z.string().trim().default(''),
});

const customerUpdate = customerInput.extend({
  totalOrders: z.number().int().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
  dueBalance: z.number().nonnegative().optional(),
  lastVisit: z.string().optional(),
  lastOrderDate: z.string().optional(),
  isNewThisMonth: z.boolean().optional(),
});

customersRouter.get('/', requirePermission('customers:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${customerColumns} FROM customers ORDER BY created_at DESC`).all();
  res.json(rows.map(mapCustomer));
});

customersRouter.post('/', requirePermission('customers:write'), (req, res) => {
  const input = parse(customerInput, req.body);
  const id = `cu-${randomUUID()}`;
  getDb()
    .prepare(`
      INSERT INTO customers (
        id, name, phone, email, area, total_orders, total_spent, due_balance,
        last_visit, last_order_date, is_new_this_month
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'Just added', '', 1)
    `)
    .run(id, input.name, input.phone, input.email, input.area);
  const row = getDb().prepare(`SELECT ${customerColumns} FROM customers WHERE id = ?`).get(id);
  res.status(201).json(mapCustomer(row as Record<string, any>));
});

customersRouter.put('/:id', requirePermission('customers:write'), (req, res) => {
  const input = parse(customerUpdate, req.body);
  const result = getDb()
    .prepare(`
      UPDATE customers SET
        name = @name, phone = @phone, email = @email, area = @area,
        total_orders = @total_orders, total_spent = @total_spent, due_balance = @due_balance,
        last_visit = @last_visit, last_order_date = @last_order_date,
        is_new_this_month = @is_new_this_month
      WHERE id = @id
    `)
    .run({
      id: req.params.id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      area: input.area,
      total_orders: input.totalOrders ?? 0,
      total_spent: input.totalSpent ?? 0,
      due_balance: input.dueBalance ?? 0,
      last_visit: input.lastVisit ?? '',
      last_order_date: input.lastOrderDate ?? '',
      is_new_this_month: input.isNewThisMonth ? 1 : 0,
    });
  if (result.changes === 0) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  const row = getDb().prepare(`SELECT ${customerColumns} FROM customers WHERE id = ?`).get(req.params.id);
  res.json(mapCustomer(row as Record<string, any>));
});

customersRouter.delete('/:id', requirePermission('customers:delete'), (req, res) => {
  const result = getDb().prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  res.status(204).end();
});

customersRouter.post('/:id/collect-due', requirePermission('dues:write'), (req, res) => {
  const db = getDb();
  const customer = db
    .prepare('SELECT id FROM customers WHERE id = ?')
    .get(req.params.id);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  db.transaction(() => {
    db.prepare('UPDATE customers SET due_balance = 0 WHERE id = ?').run(req.params.id);
    db.prepare("UPDATE sales SET payment_status = 'Paid', payment_method = 'Cash' WHERE customer_id = ? AND payment_status = 'Due'").run(req.params.id);
  })();
  const row = db.prepare(`SELECT ${customerColumns} FROM customers WHERE id = ?`).get(req.params.id);
  res.json(mapCustomer(row as Record<string, any>));
});

const supplierColumns = 'id, company, contact_name, phone, category, payable_amount, last_supply';

const supplierInput = z.object({
  company: z.string().trim().min(1),
  contactName: z.string().trim().default(''),
  phone: z.string().trim().default(''),
  category: z.string().trim().default(''),
  payableAmount: z.number().nonnegative().optional(),
  lastSupply: z.string().trim().optional(),
});

suppliersRouter.get('/', requirePermission('suppliers:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${supplierColumns} FROM suppliers ORDER BY created_at DESC`).all();
  res.json(rows.map(mapSupplier));
});

suppliersRouter.post('/', requirePermission('suppliers:write'), (req, res) => {
  const input = parse(supplierInput, req.body);
  const id = `s-${randomUUID()}`;
  getDb()
    .prepare(`
      INSERT INTO suppliers (id, company, contact_name, phone, category, payable_amount, last_supply)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, input.company, input.contactName, input.phone, input.category, input.payableAmount ?? 0, input.lastSupply ?? '');
  const row = getDb().prepare(`SELECT ${supplierColumns} FROM suppliers WHERE id = ?`).get(id);
  res.status(201).json(mapSupplier(row as Record<string, any>));
});

suppliersRouter.put('/:id', requirePermission('suppliers:write'), (req, res) => {
  const input = parse(supplierInput, req.body);
  getDb()
    .prepare(`
      UPDATE suppliers SET company = ?, contact_name = ?, phone = ?, category = ?,
        payable_amount = ?, last_supply = ? WHERE id = ?
    `)
    .run(input.company, input.contactName, input.phone, input.category, input.payableAmount ?? 0, input.lastSupply ?? '', req.params.id);
  const row = getDb().prepare(`SELECT ${supplierColumns} FROM suppliers WHERE id = ?`).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }
  res.json(mapSupplier(row as Record<string, any>));
});

suppliersRouter.delete('/:id', requirePermission('suppliers:delete'), (req, res) => {
  const result = getDb().prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }
  res.status(204).end();
});

suppliersRouter.post('/:id/settle', requirePermission('suppliers:write'), (req, res) => {
  const result = getDb().prepare('UPDATE suppliers SET payable_amount = 0 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }
  const row = getDb().prepare(`SELECT ${supplierColumns} FROM suppliers WHERE id = ?`).get(req.params.id);
  res.json(mapSupplier(row as Record<string, any>));
});

const dueColumns =
  'id, receipt_number, customer_id, customer_name, customer_phone, amount, remaining_due, method, note, date_time';

const dueInput = z.object({
  customerId: z.string().trim().min(1),
  amount: z.number().positive(),
  method: z.enum(['Cash', 'bKash', 'Nagad']),
  note: z.string().trim().optional(),
});

duesRouter.get('/', requirePermission('dues:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${dueColumns} FROM due_payments ORDER BY created_at DESC`).all();
  res.json(rows.map(mapDuePayment));
});

duesRouter.post('/', requirePermission('dues:write'), (req, res) => {
  const input = parse(dueInput, req.body);
  const db = getDb();
  const customer = db
    .prepare('SELECT id, name, phone, due_balance FROM customers WHERE id = ?')
    .get(input.customerId) as Record<string, any> | undefined;
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  const remainingDue = calculateDueAmount(customer.due_balance, input.amount);
  const count = (db.prepare('SELECT COUNT(*) AS count FROM due_payments').get() as { count: number }).count;
  const id = `dp-${randomUUID()}`;
  const receiptNumber = `#PAY-${1048 + count + 1}`;
  const now = new Date();
  const nowTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const today = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  db.transaction(() => {
    db.prepare(`
      INSERT INTO due_payments (
        id, receipt_number, customer_id, customer_name, customer_phone, amount,
        remaining_due, method, note, date_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      receiptNumber,
      customer.id,
      customer.name,
      customer.phone,
      input.amount,
      remainingDue,
      input.method,
      input.note ?? '',
      `${today}, ${nowTime}`
    );
    db.prepare('UPDATE customers SET due_balance = ? WHERE id = ?').run(remainingDue, customer.id);
    if (remainingDue === 0) {
      db.prepare("UPDATE sales SET payment_status = 'Paid', payment_method = ? WHERE customer_id = ? AND payment_status = 'Due'")
        .run(input.method === 'Cash' ? 'Cash' : input.method === 'bKash' ? 'bKash' : 'Nagad', customer.id);
    }
  })();

  const row = db.prepare(`SELECT ${dueColumns} FROM due_payments WHERE id = ?`).get(id);
  res.status(201).json(mapDuePayment(row as Record<string, any>));
});
