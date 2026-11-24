import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { id, now, pagination } from '../http.ts';
import { requirePermission, type AuthRequest } from '../middleware.ts';
import { roleAllows } from '../permissions.ts';
import { parse } from '../validate.ts';

export const menuRouter = Router();

type Row = Record<string, any>;

const categoryInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(''),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default('#4F46E5'),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().optional(),
});

const variantInput = z.object({
  menuItemId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price: z.number().int().nonnegative(),
  available: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

const itemInput = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().default(''),
  image: z.string().trim().nullable().optional(),
  price: z.number().int().nonnegative(),
  prepStation: z.enum(['kitchen', 'grill', 'beverage', 'dessert']).default('kitchen'),
  sortOrder: z.number().int().nonnegative().default(0),
  available: z.boolean().optional(),
});

function assertPriceEdit(req: AuthRequest): void {
  if (!req.auth || !roleAllows(req.auth.role, 'menu:price')) {
    throw new HttpError(403, 'You cannot change menu prices.');
  }
}

function findItem(itemId: string): Row | undefined {
  return getDb().prepare('SELECT * FROM menu_items WHERE id = ?').get(itemId) as Row | undefined;
}

function withVariants(item: Row): Row {
  const variants = getDb()
    .prepare('SELECT * FROM item_variants WHERE menu_item_id = ? ORDER BY sort_order, name')
    .all(item.id);
  return { ...item, variants };
}

menuRouter.get('/categories', requirePermission('menu:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare('SELECT * FROM menu_categories ORDER BY sort_order, name LIMIT ? OFFSET ?')
      .all(limit, offset)
  );
});

menuRouter.post('/categories', requirePermission('menu:write'), (req, res) => {
  const input = parse(categoryInput, req.body);
  const categoryId = id('cat');
  getDb()
    .prepare(`
      INSERT INTO menu_categories (id, name, description, color, sort_order, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(categoryId, input.name, input.description, input.color, input.sortOrder, input.active === false ? 0 : 1);
  res.status(201).json(getDb().prepare('SELECT * FROM menu_categories WHERE id = ?').get(categoryId));
});

menuRouter.put('/categories/:id', requirePermission('menu:write'), (req, res) => {
  const input = parse(categoryInput.partial(), req.body);
  const existing = getDb().prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!existing) throw new HttpError(404, 'Category not found.');
  getDb()
    .prepare(`
      UPDATE menu_categories SET name = ?, description = ?, color = ?, sort_order = ?, active = ?
      WHERE id = ?
    `)
    .run(
      input.name ?? existing.name,
      input.description ?? existing.description,
      input.color ?? existing.color,
      input.sortOrder ?? existing.sort_order,
      input.active === undefined ? existing.active : input.active ? 1 : 0,
      req.params.id
    );
  res.json(getDb().prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id));
});

menuRouter.delete('/categories/:id', requirePermission('menu:write'), (req, res) => {
  const result = getDb().prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Category not found.');
  res.status(204).end();
});

menuRouter.get('/variants', requirePermission('menu:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare('SELECT * FROM item_variants ORDER BY menu_item_id, sort_order LIMIT ? OFFSET ?')
      .all(limit, offset)
  );
});

menuRouter.post('/variants', requirePermission('menu:write'), (req: AuthRequest, res) => {
  const input = parse(variantInput, req.body);
  assertPriceEdit(req);
  if (!findItem(input.menuItemId)) throw new HttpError(400, 'Unknown menuItemId.');
  const variantId = id('var');
  getDb()
    .prepare(`
      INSERT INTO item_variants (id, menu_item_id, name, price, available, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(variantId, input.menuItemId, input.name, input.price, input.available === false ? 0 : 1, input.sortOrder);
  res.status(201).json(getDb().prepare('SELECT * FROM item_variants WHERE id = ?').get(variantId));
});

menuRouter.put('/variants/:id', requirePermission('menu:write'), (req: AuthRequest, res) => {
  const input = parse(variantInput.partial(), req.body);
  const existing = getDb().prepare('SELECT * FROM item_variants WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!existing) throw new HttpError(404, 'Variant not found.');
  if (input.price !== undefined) assertPriceEdit(req);
  getDb()
    .prepare(`
      UPDATE item_variants SET name = ?, price = ?, available = ?, sort_order = ? WHERE id = ?
    `)
    .run(
      input.name ?? existing.name,
      input.price ?? existing.price,
      input.available === undefined ? existing.available : input.available ? 1 : 0,
      input.sortOrder ?? existing.sort_order,
      req.params.id
    );
  res.json(getDb().prepare('SELECT * FROM item_variants WHERE id = ?').get(req.params.id));
});

menuRouter.delete('/variants/:id', requirePermission('menu:write'), (req, res) => {
  const result = getDb().prepare('DELETE FROM item_variants WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Variant not found.');
  res.status(204).end();
});

menuRouter.get('/', requirePermission('menu:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  const categoryId = req.query.categoryId;
  let sql = 'SELECT * FROM menu_items';
  const params: unknown[] = [];
  if (typeof categoryId === 'string') {
    sql += ' WHERE category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY sort_order, name LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = getDb().prepare(sql).all(...params) as Row[];
  res.json(rows.map(withVariants));
});

menuRouter.get('/:id', requirePermission('menu:read'), (req, res) => {
  const item = findItem(req.params.id);
  if (!item) throw new HttpError(404, 'Menu item not found.');
  res.json(withVariants(item));
});

menuRouter.post('/', requirePermission('menu:write'), (req: AuthRequest, res) => {
  const input = parse(itemInput, req.body);
  assertPriceEdit(req);
  if (!getDb().prepare('SELECT 1 FROM menu_categories WHERE id = ?').get(input.categoryId)) {
    throw new HttpError(400, 'Unknown categoryId.');
  }
  const itemId = id('mi');
  getDb()
    .prepare(`
      INSERT INTO menu_items (id, category_id, name, description, image, price, available, prep_station, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      itemId,
      input.categoryId,
      input.name,
      input.description,
      input.image ?? null,
      input.price,
      input.available === false ? 0 : 1,
      input.prepStation,
      input.sortOrder
    );
  res.status(201).json(withVariants(findItem(itemId)!));
});

menuRouter.put('/:id', requirePermission('menu:write'), (req: AuthRequest, res) => {
  const input = parse(itemInput.partial(), req.body);
  const existing = findItem(req.params.id);
  if (!existing) throw new HttpError(404, 'Menu item not found.');
  if (input.price !== undefined) assertPriceEdit(req);
  getDb()
    .prepare(`
      UPDATE menu_items SET category_id = @category_id, name = @name, description = @description,
        image = @image, price = @price, available = @available, prep_station = @prep_station,
        sort_order = @sort_order, updated_at = @updated_at WHERE id = @id
    `)
    .run({
      category_id: input.categoryId ?? existing.category_id,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      image: input.image === undefined ? existing.image : input.image,
      price: input.price ?? existing.price,
      available: input.available === undefined ? existing.available : input.available ? 1 : 0,
      prep_station: input.prepStation ?? existing.prep_station,
      sort_order: input.sortOrder ?? existing.sort_order,
      updated_at: now(),
      id: req.params.id,
    });
  res.json(withVariants(findItem(req.params.id)!));
});

menuRouter.patch('/:id/availability', requirePermission('menu:availability'), (req, res) => {
  const input = parse(z.object({ available: z.boolean() }), req.body);
  const result = getDb()
    .prepare('UPDATE menu_items SET available = ?, updated_at = ? WHERE id = ?')
    .run(input.available ? 1 : 0, now(), req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Menu item not found.');
  res.json(findItem(req.params.id));
});

menuRouter.delete('/:id', requirePermission('menu:write'), (req, res) => {
  const result = getDb().prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Menu item not found.');
  res.status(204).end();
});
