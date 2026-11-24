import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.ts';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  db.exec(`
    INSERT INTO users (id, name, email, role, password_hash) VALUES ('u1', 'Owner', 'owner@example.com', 'admin', 'hash');
    INSERT INTO floors (id, name) VALUES ('f1', 'Ground');
    INSERT INTO tables (id, floor_id, number) VALUES ('t1', 'f1', '1');
    INSERT INTO menu_categories (id, name) VALUES ('c1', 'Rice');
    INSERT INTO menu_items (id, category_id, name, price) VALUES ('m1', 'c1', 'Biryani', 55000);
    INSERT INTO ingredients (id, name, stock, low_stock_threshold) VALUES ('i1', 'Rice', 10, 2);
    INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity) VALUES ('m1', 'i1', 1);
  `);
});

function order(overrides: Record<string, unknown> = {}): string {
  const values = {
    id: 'o1', order_number: 'ORD-0001', table_id: 't1', opened_by: 'u1', ...overrides,
  };
  const keys = Object.keys(values);
  db.prepare(`INSERT INTO orders (${keys.join(', ')}) VALUES (${keys.map((key) => `@${key}`).join(', ')})`).run(values);
  return String(values.id);
}

describe('schema constraints and delete rules', () => {
  it('requires a valid foreign key on every child row', () => {
    expect(() => db.prepare("INSERT INTO tables (id, floor_id, number) VALUES ('t2', 'missing', '2')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, line_total) VALUES ('oi1', 'missing', 'm1', 'Dish', 1, 100, 100)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity) VALUES ('m1', 'missing', 1)").run()).toThrow();
  });

  it('enforces UNIQUE table number per floor, bill number and ingredient name', () => {
    expect(() => db.prepare("INSERT INTO tables (id, floor_id, number) VALUES ('t2', 'f1', '1')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO tables (id, floor_id, number) VALUES ('t2', 'f1', '2')").run()).not.toThrow();
    order({ bill_number: 'INV-0001' });
    expect(() => order({ id: 'o2', order_number: 'ORD-0002', bill_number: 'INV-0001' })).toThrow();
    expect(() => db.prepare("INSERT INTO ingredients (id, name) VALUES ('i2', 'Rice')").run()).toThrow();
  });

  it('rejects negative prices, non-positive quantities and negative stock', () => {
    expect(() => db.prepare("INSERT INTO menu_items (id, category_id, name, price) VALUES ('m2', 'c1', 'Bad', -1)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, line_total) VALUES ('oi1', 'o1', 'm1', 'Dish', 0, 100, 0)").run()).toThrow();
    expect(() => db.prepare("UPDATE ingredients SET stock = -1 WHERE id = 'i1'").run()).toThrow();
  });

  it('RESTRICTs deletion of historical parents and CASCADEs order-owned children', () => {
    const id = order();
    db.prepare("INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, line_total) VALUES ('oi1', ?, 'm1', 'Dish', 1, 100, 100)").run(id);
    db.prepare("INSERT INTO payments (id, order_id, method, amount) VALUES ('p1', ?, 'Cash', 100)").run(id);
    expect(() => db.prepare('DELETE FROM orders WHERE id = ?').run(id)).toThrow();
    expect(() => db.prepare('DELETE FROM tables WHERE id = ?').run('t1')).toThrow();
    db.prepare('DELETE FROM payments WHERE id = ?').run('p1');
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    expect((db.prepare('SELECT COUNT(*) AS count FROM order_items').get() as { count: number }).count).toBe(0);
  });

  it('prevents QR orders from having a staff opener and waiter orders without one', () => {
    expect(() => order({ id: 'qr', order_number: 'ORD-QR', source: 'qr', opened_by: null })).not.toThrow();
    expect(() => order({ id: 'badqr', order_number: 'ORD-BADQR', source: 'qr' })).toThrow();
    expect(() => order({ id: 'badwaiter', order_number: 'ORD-BADW', opened_by: null })).toThrow();
  });
});
