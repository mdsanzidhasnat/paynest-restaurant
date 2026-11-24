import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { mapCategory, mapProduct } from '../mappers.ts';
import { asyncHandler, requirePermission } from '../middleware.ts';
import { parse } from '../validate.ts';

export const productsRouter = Router();
export const categoriesRouter = Router();
export const inventoryRouter = Router();

const productInput = z.object({
  sku: z.string().trim().min(1),
  barcode: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  brand: z.string().trim().optional(),
  unit: z.string().trim().min(1),
  costPrice: z.number().nonnegative(),
  sellPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
});

const productUpdate = productInput.extend({
  soldToday: z.number().int().nonnegative().optional(),
  soldThisWeek: z.number().int().nonnegative().optional(),
});

const productColumns = `
  id, sku, barcode, name, category, brand, unit, cost_price, sell_price,
  stock, low_stock_threshold, sold_today, sold_this_week, description, image
`;

function productValues(product: z.infer<typeof productInput>, id: string, soldToday = 0, soldThisWeek = 0) {
  return {
    id,
    sku: product.sku,
    barcode: product.barcode ?? null,
    name: product.name,
    category: product.category,
    brand: product.brand ?? null,
    unit: product.unit,
    cost_price: product.costPrice,
    sell_price: product.sellPrice,
    stock: product.stock,
    low_stock_threshold: product.lowStockThreshold,
    sold_today: soldToday,
    sold_this_week: soldThisWeek,
    description: product.description ?? null,
    image: product.image ?? null,
  };
}

productsRouter.get('/', requirePermission('products:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${productColumns} FROM products ORDER BY created_at DESC`).all();
  res.json(rows.map(mapProduct));
});

productsRouter.post('/', requirePermission('products:write'), (req, res) => {
  const input = parse(productInput, req.body);
  const id = `p-${randomUUID()}`;
  const values = productValues(input, id);
  getDb()
    .prepare(`
      INSERT INTO products (
        ${productColumns}
      ) VALUES (
        @id, @sku, @barcode, @name, @category, @brand, @unit, @cost_price, @sell_price,
        @stock, @low_stock_threshold, @sold_today, @sold_this_week, @description, @image
      )
    `)
    .run(values);
  const row = getDb().prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(id);
  res.status(201).json(mapProduct(row as Record<string, any>));
});

productsRouter.post('/import', requirePermission('products:write'), (req, res) => {
  const { products } = parse(z.object({ products: z.array(productInput) }), req.body);
  const insert = getDb().prepare(`
    INSERT INTO products (
      ${productColumns}
    ) VALUES (
      @id, @sku, @barcode, @name, @category, @brand, @unit, @cost_price, @sell_price,
      @stock, @low_stock_threshold, @sold_today, @sold_this_week, @description, @image
    )
  `);
  const rows = products.map((product) => productValues(product, `p-${randomUUID()}`));
  getDb().transaction(() => {
    for (const row of rows) insert.run(row);
  })();
  res.status(201).json(rows.map((row) => mapProduct(row)));
});

productsRouter.put('/:id', requirePermission('products:write'), (req, res) => {
  const input = parse(productUpdate, req.body);
  const values = productValues(input, req.params.id, input.soldToday ?? 0, input.soldThisWeek ?? 0);
  getDb()
    .prepare(`
      UPDATE products SET
        sku = @sku, barcode = @barcode, name = @name, category = @category,
        brand = @brand, unit = @unit, cost_price = @cost_price, sell_price = @sell_price,
        stock = @stock, low_stock_threshold = @low_stock_threshold,
        sold_today = @sold_today, sold_this_week = @sold_this_week,
        description = @description, image = @image, updated_at = datetime('now')
      WHERE id = @id
    `)
    .run(values);
  const row = getDb().prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  res.json(mapProduct(row as Record<string, any>));
});

productsRouter.delete('/:id', requirePermission('products:delete'), (req, res) => {
  const result = getDb().prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  res.status(204).end();
});

const categoryInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default('#4F46E5'),
});

const categoryColumns = 'id, name, description, color, revenue_share, revenue_amount';

categoriesRouter.get('/', requirePermission('categories:read'), (_req, res) => {
  const rows = getDb().prepare(`SELECT ${categoryColumns} FROM categories ORDER BY created_at DESC`).all();
  res.json(rows.map(mapCategory));
});

categoriesRouter.post('/', requirePermission('categories:write'), (req, res) => {
  const input = parse(categoryInput, req.body);
  const id = `c-${randomUUID()}`;
  getDb()
    .prepare(`
      INSERT INTO categories (id, name, description, color, revenue_share, revenue_amount)
      VALUES (?, ?, ?, ?, 0, 0)
    `)
    .run(id, input.name, input.description ?? '', input.color);
  const row = getDb().prepare(`SELECT ${categoryColumns} FROM categories WHERE id = ?`).get(id);
  res.status(201).json(mapCategory(row as Record<string, any>));
});

categoriesRouter.put('/:id', requirePermission('categories:write'), (req, res) => {
  const input = parse(categoryInput, req.body);
  const result = getDb()
    .prepare('UPDATE categories SET name = ?, description = ?, color = ? WHERE id = ?')
    .run(input.name, input.description ?? '', input.color, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }
  const row = getDb().prepare(`SELECT ${categoryColumns} FROM categories WHERE id = ?`).get(req.params.id);
  res.json(mapCategory(row as Record<string, any>));
});

categoriesRouter.delete('/:id', requirePermission('categories:delete'), (req, res) => {
  const result = getDb().prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }
  res.status(204).end();
});

inventoryRouter.get('/', requirePermission('inventory:read'), (_req, res) => {
  const rows = getDb()
    .prepare('SELECT id, sku, barcode, name, category, brand, unit, cost_price, sell_price, stock, low_stock_threshold, sold_today, sold_this_week, description, image FROM products ORDER BY stock ASC')
    .all();
  res.json({
    products: rows.map(mapProduct),
    lowStockCount: rows.filter((row: any) => row.stock <= row.low_stock_threshold).length,
  });
});

inventoryRouter.post(
  '/restock',
  requirePermission('inventory:write'),
  asyncHandler((req, res) => {
    const input = parse(
      z.object({ productId: z.string().trim().min(1), quantity: z.number().int().positive() }),
      req.body
    );
    const result = getDb()
      .prepare('UPDATE products SET stock = stock + ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(input.quantity, input.productId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const row = getDb()
      .prepare('SELECT id, sku, barcode, name, category, brand, unit, cost_price, sell_price, stock, low_stock_threshold, sold_today, sold_this_week, description, image FROM products WHERE id = ?')
      .get(input.productId);
    res.json(mapProduct(row as Record<string, any>));
  })
);
