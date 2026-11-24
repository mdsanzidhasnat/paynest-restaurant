import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { id, now, pagination } from '../http.ts';
import { requirePermission } from '../middleware.ts';
import { signTableToken } from '../qr-token.ts';
import { parse } from '../validate.ts';

export const tablesRouter = Router();

type Row = Record<string, any>;

const floorInput = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().nonnegative().default(0),
});

const tableInput = z.object({
  floorId: z.string().trim().min(1),
  number: z.string().trim().min(1),
  seats: z.number().int().positive().default(2),
  x: z.number().int().nonnegative().default(0),
  y: z.number().int().nonnegative().default(0),
  shape: z.enum(['round', 'square']).default('round'),
});

function floorExists(floorId: string): boolean {
  return Boolean(getDb().prepare('SELECT 1 FROM floors WHERE id = ?').get(floorId));
}

tablesRouter.get('/floors', requirePermission('tables:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  const rows = getDb()
    .prepare('SELECT * FROM floors ORDER BY sort_order, name LIMIT ? OFFSET ?')
    .all(limit, offset);
  res.json(rows);
});

tablesRouter.post('/floors', requirePermission('tables:write'), (req, res) => {
  const input = parse(floorInput, req.body);
  const floorId = id('flr');
  getDb()
    .prepare('INSERT INTO floors (id, name, sort_order) VALUES (?, ?, ?)')
    .run(floorId, input.name, input.sortOrder);
  res.status(201).json(getDb().prepare('SELECT * FROM floors WHERE id = ?').get(floorId));
});

tablesRouter.get('/map', requirePermission('tables:read'), (_req, res) => {
  const floors = getDb()
    .prepare('SELECT * FROM floors ORDER BY sort_order, name')
    .all() as Row[];
  const tables = getDb()
    .prepare(`
      SELECT t.*, f.name AS floor_name
      FROM tables t JOIN floors f ON f.id = t.floor_id
      ORDER BY f.sort_order, t.number
    `)
    .all() as Row[];
  res.json(
    floors.map((floor) => ({
      ...floor,
      tables: tables.filter((table) => table.floor_id === floor.id),
    }))
  );
});

tablesRouter.get('/', requirePermission('tables:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  const status = req.query.status;
  let sql = 'SELECT t.*, f.name AS floor_name FROM tables t JOIN floors f ON f.id = t.floor_id';
  const params: unknown[] = [];
  if (typeof status === 'string' && ['free', 'occupied', 'bill_pending'].includes(status)) {
    sql += ' WHERE t.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY f.sort_order, t.number LIMIT ? OFFSET ?';
  params.push(limit, offset);
  res.json(getDb().prepare(sql).all(...params));
});

tablesRouter.get('/:id', requirePermission('tables:read'), (req, res) => {
  const row = getDb()
    .prepare(`
      SELECT t.*, f.name AS floor_name FROM tables t JOIN floors f ON f.id = t.floor_id
      WHERE t.id = ?
    `)
    .get(req.params.id);
  if (!row) throw new HttpError(404, 'Table not found.');
  res.json(row);
});

tablesRouter.post('/', requirePermission('tables:write'), (req, res) => {
  const input = parse(tableInput, req.body);
  if (!floorExists(input.floorId)) throw new HttpError(400, 'Unknown floorId.');
  const tableId = id('tbl');
  getDb()
    .prepare(`
      INSERT INTO tables (id, floor_id, number, seats, x, y, shape, status, qr_secret_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'free', 1)
    `)
    .run(tableId, input.floorId, input.number, input.seats, input.x, input.y, input.shape);
  res.status(201).json(getDb().prepare('SELECT * FROM tables WHERE id = ?').get(tableId));
});

tablesRouter.put('/:id', requirePermission('tables:write'), (req, res) => {
  const input = parse(tableInput.partial(), req.body);
  const existing = getDb().prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!existing) throw new HttpError(404, 'Table not found.');
  const next = {
    floor_id: input.floorId ?? existing.floor_id,
    number: input.number ?? existing.number,
    seats: input.seats ?? existing.seats,
    x: input.x ?? existing.x,
    y: input.y ?? existing.y,
    shape: input.shape ?? existing.shape,
  };
  if (!floorExists(next.floor_id)) throw new HttpError(400, 'Unknown floorId.');
  getDb()
    .prepare(`
      UPDATE tables SET floor_id = @floor_id, number = @number, seats = @seats,
        x = @x, y = @y, shape = @shape, updated_at = @updated_at WHERE id = @id
    `)
    .run({ ...next, updated_at: now(), id: req.params.id });
  res.json(getDb().prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id));
});

tablesRouter.get('/:id/qr', requirePermission('tables:read'), (req, res) => {
  const row = getDb().prepare('SELECT id, number, qr_secret_version FROM tables WHERE id = ?').get(req.params.id) as
    | Row
    | undefined;
  if (!row) throw new HttpError(404, 'Table not found.');
  const token = signTableToken(row.id, row.qr_secret_version);
  res.json({
    tableId: row.id,
    tableNumber: row.number,
    version: row.qr_secret_version,
    token,
    path: `/m/${token}`,
    url: `/m/${token}`,
  });
});

tablesRouter.post('/:id/qr/rotate', requirePermission('tables:qr'), (req, res) => {
  const db = getDb();
  const result = db
    .prepare('UPDATE tables SET qr_secret_version = qr_secret_version + 1, updated_at = ? WHERE id = ?')
    .run(now(), req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Table not found.');
  const row = db
    .prepare('SELECT id, number, qr_secret_version FROM tables WHERE id = ?')
    .get(req.params.id) as Row;
  const token = signTableToken(row.id, row.qr_secret_version);
  res.json({
    tableId: row.id,
    tableNumber: row.number,
    version: row.qr_secret_version,
    token,
    path: `/m/${token}`,
    url: `/m/${token}`,
  });
});
