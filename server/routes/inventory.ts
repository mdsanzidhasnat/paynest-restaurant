import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { id, now, pagination } from '../http.ts';
import { requirePermission, type AuthRequest } from '../middleware.ts';
import { applyStockChange, roundStockQuantity } from '../stock.ts';
import { parse } from '../validate.ts';

export const inventoryRouter = Router();

type Row = Record<string, any>;

const ingredientInput = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1).default('pcs'),
  stock: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().nonnegative().default(0),
  unitCost: z.number().int().nonnegative().default(0),
});

const adjustInput = z.object({
  quantity: z.number().refine((value) => value !== 0, 'Adjustment quantity cannot be zero.'),
  note: z.string().trim().default(''),
});

const recipeInput = z.object({
  lines: z
    .array(
      z.object({
        ingredientId: z.string().trim().min(1),
        quantity: z.number().positive(),
      })
    )
    .max(200),
});

inventoryRouter.get('/low-stock', requirePermission('inventory:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare(`
        SELECT * FROM ingredients WHERE stock <= low_stock_threshold
        ORDER BY (stock - low_stock_threshold) ASC, name LIMIT ? OFFSET ?
      `)
      .all(limit, offset)
  );
});

inventoryRouter.get('/movements', requirePermission('inventory:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare(`
        SELECT m.*, i.name AS ingredient_name FROM stock_movements m
        JOIN ingredients i ON i.id = m.ingredient_id
        ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?
      `)
      .all(limit, offset)
  );
});

inventoryRouter.get('/recipes/:menuItemId', requirePermission('recipe:read'), (req, res) => {
  const rows = getDb()
    .prepare(`
      SELECT r.quantity, r.ingredient_id, i.name, i.unit, i.stock, i.low_stock_threshold
      FROM recipe_items r JOIN ingredients i ON i.id = r.ingredient_id
      WHERE r.menu_item_id = ? ORDER BY i.name
    `)
    .all(req.params.menuItemId);
  res.json(rows);
});

inventoryRouter.put('/recipes/:menuItemId', requirePermission('recipe:write'), (req, res) => {
  const input = parse(recipeInput, req.body);
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM menu_items WHERE id = ?').get(req.params.menuItemId)) {
    throw new HttpError(400, 'Unknown menuItemId.');
  }
  const seen = new Set<string>();
  const lines = input.lines.map((line) => ({
    ingredientId: line.ingredientId,
    quantity: roundStockQuantity(line.quantity, 'Recipe quantity'),
  }));
  for (const line of lines) {
    if (seen.has(line.ingredientId)) {
      throw new HttpError(400, 'Duplicate ingredientId in recipe lines.');
    }
    seen.add(line.ingredientId);
    if (line.quantity <= 0) {
      throw new HttpError(400, 'Recipe quantities must be at least 0.001.');
    }
    if (!db.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(line.ingredientId)) {
      throw new HttpError(400, `Unknown ingredientId: ${line.ingredientId}`);
    }
  }
  db.transaction(() => {
    db.prepare('DELETE FROM recipe_items WHERE menu_item_id = ?').run(req.params.menuItemId);
    const insert = db.prepare(
      'INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity) VALUES (?, ?, ?)'
    );
    for (const line of lines) {
      insert.run(req.params.menuItemId, line.ingredientId, line.quantity);
    }
  }).immediate();
  res.json(
    getDb()
      .prepare('SELECT * FROM recipe_items WHERE menu_item_id = ? ORDER BY ingredient_id')
      .all(req.params.menuItemId)
  );
});

inventoryRouter.get('/ingredients', requirePermission('inventory:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare(`
        SELECT *, CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END AS low_stock
        FROM ingredients ORDER BY name LIMIT ? OFFSET ?
      `)
      .all(limit, offset)
  );
});

inventoryRouter.get('/ingredients/:id', requirePermission('inventory:read'), (req, res) => {
  const row = getDb().prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Ingredient not found.');
  res.json(row);
});

inventoryRouter.post('/ingredients', requirePermission('inventory:write'), (req, res) => {
  const input = parse(ingredientInput, req.body);
  const ingredientId = id('ing');
  getDb()
    .prepare(`
      INSERT INTO ingredients (id, name, unit, stock, low_stock_threshold, unit_cost)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      ingredientId,
      input.name,
      input.unit,
      roundStockQuantity(input.stock, 'Stock'),
      roundStockQuantity(input.lowStockThreshold, 'Low stock threshold'),
      input.unitCost
    );
  res.status(201).json(getDb().prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredientId));
});

inventoryRouter.put('/ingredients/:id', requirePermission('inventory:write'), (req, res) => {
  const input = parse(ingredientInput.partial(), req.body);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!existing) throw new HttpError(404, 'Ingredient not found.');
  db.prepare(`
    UPDATE ingredients SET name = ?, unit = ?, stock = ?, low_stock_threshold = ?,
      unit_cost = ?, updated_at = ? WHERE id = ?
  `).run(
    input.name ?? existing.name,
    input.unit ?? existing.unit,
    input.stock === undefined
      ? roundStockQuantity(existing.stock, 'Stock')
      : roundStockQuantity(input.stock, 'Stock'),
    input.lowStockThreshold === undefined
      ? roundStockQuantity(existing.low_stock_threshold, 'Low stock threshold')
      : roundStockQuantity(input.lowStockThreshold, 'Low stock threshold'),
    input.unitCost ?? existing.unit_cost,
    now(),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id));
});

inventoryRouter.delete('/ingredients/:id', requirePermission('inventory:write'), (req, res) => {
  const result = getDb().prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Ingredient not found.');
  res.status(204).end();
});

inventoryRouter.post('/ingredients/:id/adjust', requirePermission('inventory:write'), (req: AuthRequest, res) => {
  const input = parse(adjustInput, req.body);
  const db = getDb();
  const ingredient = db.prepare('SELECT id, stock FROM ingredients WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!ingredient) throw new HttpError(404, 'Ingredient not found.');
  const delta = roundStockQuantity(input.quantity, 'Adjustment quantity');
  if (delta === 0) throw new HttpError(400, 'Adjustment quantity is too small.');
  const nextStock = applyStockChange(ingredient.stock, delta);

  db.transaction(() => {
    db.prepare('UPDATE ingredients SET stock = ?, updated_at = ? WHERE id = ?').run(
      nextStock,
      now(),
      req.params.id
    );
    db.prepare(`
      INSERT INTO stock_movements (ingredient_id, quantity, reason, note, created_by)
      VALUES (?, ?, 'manual', ?, ?)
    `).run(req.params.id, delta, input.note, req.auth!.userId);
  }).immediate();
  res.status(201).json(db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id));
});
