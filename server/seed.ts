import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import {
  INITIAL_CATEGORIES,
  INITIAL_COMPLETED_ORDERS,
  INITIAL_FLOORS,
  INITIAL_INGREDIENTS,
  INITIAL_MENU_ITEMS,
  INITIAL_TABLES,
  RESTAURANT_SETTINGS,
  variantPrice,
  dayLabel,
  isoDaysAgo,
} from '../src/data/seedData.ts';
import { calculateOrderTotals } from './billing.ts';
import { logStage, logWarn } from './log.ts';
import { withBillNumber, withOrderNumber } from './numbering.ts';
import type { Role } from './permissions.ts';
import { roundStockQuantity } from './stock.ts';

export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  lastActive: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { key: 'ADMIN', id: 'u1', name: 'Sanzid Hasnat', email: 'admin@example.com', role: 'admin' },
  { key: 'MANAGER', id: 'u2', name: 'Nabil Rahman', email: 'manager@example.com', role: 'manager' },
  { key: 'WAITER', id: 'u3', name: 'Tasnim Akter', email: 'waiter@example.com', role: 'waiter' },
  { key: 'KITCHEN', id: 'u4', name: 'Rafiqul Islam', email: 'kitchen@example.com', role: 'kitchen' },
  { key: 'CASHIER', id: 'u5', name: 'Nusrat Jahan', email: 'cashier@example.com', role: 'cashier' },
] as const;

const loggedGeneratedPasswords = new Set<string>();

function lastActiveLabel(minutesAgo: number): string {
  if (minutesAgo === 0) return 'Online now';
  const time = new Date(Date.now() - minutesAgo * 60_000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `Today, ${time}`;
}

/** Demo seeding is opt-in so an empty production database gains no demo accounts. */
export function isDemoSeedingEnabled(): boolean {
  return process.env.SEED_DEMO_DATA?.trim().toLowerCase() === 'true';
}

function resolveDemoPassword(key: string, email: string): string {
  const configured = process.env[`${key}_PASSWORD`]?.trim();
  if (configured) return configured;
  const generated = randomBytes(18).toString('base64url');
  if (!loggedGeneratedPasswords.has(key)) {
    loggedGeneratedPasswords.add(key);
    logWarn(`Generated random demo password for ${email}: ${generated} (shown once)`);
  }
  return generated;
}

/** Emails/passwords come only from the environment; generated values are logged once. */
export function getDemoAccounts(): DemoAccount[] {
  return DEMO_ACCOUNTS.map((account) => {
    const email = (process.env[`${account.key}_EMAIL`]?.trim() || account.email).toLowerCase();
    return {
      id: account.id,
      name: account.name,
      email,
      role: account.role,
      avatar: null,
      lastActive: lastActiveLabel(account.role === 'admin' ? 0 : 30 + DEMO_ACCOUNTS.indexOf(account) * 15),
      password: resolveDemoPassword(account.key, email),
    };
  });
}

export function isDatabaseEmpty(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  return row.count === 0;
}

/** Inserts new demo rows only when the users table is empty. Replaces only on explicit reset. */
export function seedDatabase(db: Database.Database, options: { replace?: boolean } = {}): void {
  if (!options.replace && !isDatabaseEmpty(db)) {
    logStage('Seed checked: existing users kept');
    return;
  }
  if (!isDemoSeedingEnabled()) {
    logStage('Seed skipped: SEED_DEMO_DATA is not true');
    return;
  }

  const accounts = getDemoAccounts();
  db.transaction(() => {
    if (options.replace) {
      // Static statements; table names are never supplied by a request.
      db.exec(`
        DELETE FROM stock_movements;
        DELETE FROM payments;
        DELETE FROM order_items;
        DELETE FROM orders;
        DELETE FROM recipe_items;
        DELETE FROM item_variants;
        DELETE FROM menu_items;
        DELETE FROM ingredients;
        DELETE FROM menu_categories;
        DELETE FROM tables;
        DELETE FROM floors;
        DELETE FROM daily_sales;
        DELETE FROM settings;
        DELETE FROM users;
        DELETE FROM number_sequences;
        INSERT INTO number_sequences (name, last_value) VALUES ('order', 0), ('bill', 0);
      `);
    }

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, phone, role, active, avatar, last_active, password_hash)
      VALUES (@id, @name, @email, @phone, @role, 1, @avatar, @last_active, @password_hash)
    `);
    for (const account of accounts) {
      insertUser.run({
        id: account.id,
        name: account.name,
        email: account.email,
        phone: '+880 1700-000000',
        role: account.role,
        avatar: account.avatar,
        last_active: account.lastActive,
        password_hash: bcrypt.hashSync(account.password, 10),
      });
    }

    db.prepare(`
      INSERT INTO settings (
        id, restaurant_name, phone, email, address, currency_symbol, vat_percent,
        service_charge_percent, invoice_prefix, paper_size, receipt_footer, low_stock_default
      ) VALUES (
        1, @restaurant_name, @phone, @email, @address, @currency_symbol, @vat_percent,
        @service_charge_percent, @invoice_prefix, @paper_size, @receipt_footer, @low_stock_default
      )
    `).run({
      restaurant_name: RESTAURANT_SETTINGS.restaurantName,
      phone: RESTAURANT_SETTINGS.phone,
      email: RESTAURANT_SETTINGS.email,
      address: RESTAURANT_SETTINGS.address,
      currency_symbol: RESTAURANT_SETTINGS.currencySymbol,
      vat_percent: RESTAURANT_SETTINGS.vatPercent,
      service_charge_percent: RESTAURANT_SETTINGS.serviceChargePercent,
      invoice_prefix: RESTAURANT_SETTINGS.invoicePrefix,
      paper_size: RESTAURANT_SETTINGS.paperSize,
      receipt_footer: RESTAURANT_SETTINGS.receiptFooter,
      low_stock_default: RESTAURANT_SETTINGS.lowStockDefault,
    });

    const insertFloor = db.prepare(
      'INSERT INTO floors (id, name, sort_order) VALUES (@id, @name, @sort_order)'
    );
    for (const floor of INITIAL_FLOORS) {
      insertFloor.run({ id: floor.id, name: floor.name, sort_order: floor.sortOrder });
    }

    const insertTable = db.prepare(`
      INSERT INTO tables (id, floor_id, number, seats, x, y, shape, status, qr_secret_version)
      VALUES (@id, @floor_id, @number, @seats, @x, @y, @shape, 'free', 1)
    `);
    for (const table of INITIAL_TABLES) {
      insertTable.run({
        id: table.id,
        floor_id: table.floorId,
        number: table.number,
        seats: table.seats,
        x: table.x,
        y: table.y,
        shape: table.shape,
      });
    }

    const insertCategory = db.prepare(`
      INSERT INTO menu_categories (id, name, description, color, sort_order)
      VALUES (@id, @name, @description, @color, @sort_order)
    `);
    for (const category of INITIAL_CATEGORIES) {
      insertCategory.run({
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        sort_order: category.sortOrder,
      });
    }

    const insertIngredient = db.prepare(`
      INSERT INTO ingredients (id, name, unit, stock, low_stock_threshold, unit_cost)
      VALUES (@id, @name, @unit, @stock, @low_stock_threshold, @unit_cost)
    `);
    for (const ingredient of INITIAL_INGREDIENTS) {
      insertIngredient.run({
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        stock: roundStockQuantity(ingredient.stock, 'Seed stock'),
        low_stock_threshold: roundStockQuantity(ingredient.lowStockThreshold, 'Seed low stock threshold'),
        unit_cost: ingredient.unitCost,
      });
    }

    const insertItem = db.prepare(`
      INSERT INTO menu_items (id, category_id, name, description, image, price, prep_station, sort_order)
      VALUES (@id, @category_id, @name, @description, @image, @price, @prep_station, @sort_order)
    `);
    const insertVariant = db.prepare(`
      INSERT INTO item_variants (id, menu_item_id, name, price, sort_order)
      VALUES (@id, @menu_item_id, @name, @price, @sort_order)
    `);
    const insertRecipe = db.prepare(`
      INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity) VALUES (?, ?, ?)
    `);
    for (const item of INITIAL_MENU_ITEMS) {
      insertItem.run({
        id: item.id,
        category_id: item.categoryId,
        name: item.name,
        description: item.description,
        image: item.image,
        price: item.price,
        prep_station: item.prepStation,
        sort_order: item.sortOrder,
      });
      item.variants.forEach((variant, index) => {
        insertVariant.run({
          id: `${item.id}v${index + 1}`,
          menu_item_id: item.id,
          name: variant.name,
          price: variantPrice(item, variant),
          sort_order: index,
        });
      });
      for (const [ingredientId, quantity] of Object.entries(item.recipe)) {
        const rounded = roundStockQuantity(quantity, 'Seed recipe quantity');
        if (rounded > 0) insertRecipe.run(item.id, ingredientId, rounded);
      }
    }

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, order_number, bill_number, table_id, source, status, opened_by, guest_count,
        subtotal, discount, vat_amount, service_charge, total, payment_status,
        payment_method, created_at, opened_at, closed_at, paid_at
      ) VALUES (
        @id, @order_number, @bill_number, @table_id, 'waiter', 'closed', @opened_by, @guest_count,
        @subtotal, @discount, @vat_amount, @service_charge, @total, 'paid',
        @payment_method, @created_at, @opened_at, @closed_at, @paid_at
      )
    `);
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, menu_item_id, variant_id, name_snapshot, variant_name_snapshot,
        quantity, status, unit_price, line_total, created_at, served_at
      ) VALUES (
        @id, @order_id, @menu_item_id, @variant_id, @name_snapshot, @variant_name_snapshot,
        @quantity, 'served', @unit_price, @line_total, @created_at, @served_at
      )
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (id, order_id, method, amount, recorded_by, created_at)
      VALUES (@id, @order_id, @method, @amount, @recorded_by, @created_at)
    `);

    INITIAL_COMPLETED_ORDERS.forEach((sample, index) => {
      const createdAt = isoDaysAgo(sample.daysAgo, sample.minutesAgo);
      const closedAt = isoDaysAgo(sample.daysAgo, sample.minutesAgo - 45);
      const lines = sample.lines.map((line, lineIndex) => {
        const item = INITIAL_MENU_ITEMS.find((entry) => entry.id === line.itemId);
        if (!item) throw new Error(`Seed order references unknown item ${line.itemId}`);
        const variant = item.variants[line.variantIndex] ?? item.variants[0];
        return {
          id: `oi${index + 1}_${lineIndex + 1}`,
          menuItem: item,
          variant,
          quantity: line.quantity,
        };
      });
      const totals = calculateOrderTotals(
        lines.map((line) => ({ quantity: line.quantity, unitPrice: variantPrice(line.menuItem, line.variant) })),
        sample.discount,
        {
          vatPercent: RESTAURANT_SETTINGS.vatPercent,
          serviceChargePercent: RESTAURANT_SETTINGS.serviceChargePercent,
        }
      );

      const orderId = `o${index + 1}`;
      withOrderNumber(db, (orderNumber) =>
        withBillNumber(db, (billNumber) =>
          insertOrder.run({
            id: orderId,
            order_number: orderNumber,
            bill_number: billNumber,
            table_id: sample.tableId,
            opened_by: sample.openedById,
            guest_count: sample.guestCount,
            subtotal: totals.subtotal,
            discount: totals.discount,
            vat_amount: totals.vatAmount,
            service_charge: totals.serviceCharge,
            total: totals.total,
            payment_method: sample.method,
            created_at: createdAt,
            opened_at: createdAt,
            closed_at: closedAt,
            paid_at: closedAt,
          })
        )
      );

      for (const line of lines) {
        insertOrderItem.run({
          id: line.id,
          order_id: orderId,
          menu_item_id: line.menuItem.id,
          variant_id: `${line.menuItem.id}v${line.menuItem.variants.indexOf(line.variant) + 1}`,
          name_snapshot: line.menuItem.name,
          variant_name_snapshot: line.variant.name,
          quantity: line.quantity,
          unit_price: variantPrice(line.menuItem, line.variant),
          line_total: variantPrice(line.menuItem, line.variant) * line.quantity,
          created_at: createdAt,
          served_at: closedAt,
        });
      }
      insertPayment.run({
        id: `pay${index + 1}`,
        order_id: orderId,
        method: sample.method,
        amount: totals.total,
        recorded_by: 'u5',
        created_at: closedAt,
      });
    });

    const insertDailySale = db.prepare(`
      INSERT OR IGNORE INTO daily_sales (sales_date, day, date_label, sales, orders, vat, service_charge, profit)
      VALUES (@sales_date, @day, @date_label, @sales, @orders, @vat, @service_charge, @profit)
    `);
    for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
      const label = dayLabel(daysAgo);
      const matching = INITIAL_COMPLETED_ORDERS.filter((order) => order.daysAgo === daysAgo);
      const totals = matching.reduce((sum, order) => {
        const lines = order.lines.map((line) => {
          const item = INITIAL_MENU_ITEMS.find((entry) => entry.id === line.itemId);
          const variant = item?.variants[line.variantIndex] ?? item?.variants[0];
          return { quantity: line.quantity, unitPrice: item && variant ? variantPrice(item, variant) : 0 };
        });
        return sum + calculateOrderTotals(lines, order.discount, {
          vatPercent: RESTAURANT_SETTINGS.vatPercent,
          serviceChargePercent: RESTAURANT_SETTINGS.serviceChargePercent,
        }).total;
      }, 0);
      insertDailySale.run({
        sales_date: label.date,
        day: label.day,
        date_label: label.dateLabel,
        sales: totals,
        orders: matching.length,
        vat: 0,
        service_charge: 0,
        profit: 0,
      });
    }
  }).immediate();

  logStage(`Seed complete: ${accounts.length} users, ${INITIAL_TABLES.length} tables, ${INITIAL_MENU_ITEMS.length} menu items`);
}
