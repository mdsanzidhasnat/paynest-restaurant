import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { pagination } from '../http.ts';
import { mapUser } from '../mappers.ts';
import { requirePermission, requireRole, type AuthRequest } from '../middleware.ts';
import { ROLES } from '../permissions.ts';
import { parse } from '../validate.ts';

export const usersRouter = Router();

type Row = Record<string, any>;

const userColumns = 'id, name, email, phone, role, active, avatar, last_active';

const userInput = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().default(''),
  role: z.enum(ROLES),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

function findUser(userId: string): Row | undefined {
  return getDb()
    .prepare(`SELECT ${userColumns}, password_hash FROM users WHERE id = ?`)
    .get(userId) as Row | undefined;
}

function countActiveAdmins(): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1")
      .get() as { count: number }
  ).count;
}

function assertNotSelf(req: AuthRequest, userId: string): void {
  if (req.auth?.userId === userId) {
    throw new HttpError(403, 'You cannot change your own role or status.');
  }
}

function assertLastAdmin(target: Row, nextRole: string, nextActive: number): void {
  const wasActiveAdmin = target.role === 'admin' && target.active === 1;
  const remainsActiveAdmin = nextRole === 'admin' && nextActive === 1;
  if (wasActiveAdmin && !remainsActiveAdmin && countActiveAdmins() <= 1) {
    throw new HttpError(409, 'The last active admin cannot be removed, demoted or deactivated.');
  }
}

usersRouter.get('/', requirePermission('users:read'), requireRole('admin'), (req, res) => {
  const { limit, offset } = pagination(req);
  const rows = getDb()
    .prepare(`SELECT ${userColumns} FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(limit, offset);
  res.json(rows.map(mapUser));
});

usersRouter.get('/:id', requirePermission('users:read'), requireRole('admin'), (req, res) => {
  const row = findUser(req.params.id);
  if (!row) throw new HttpError(404, 'User not found.');
  res.json(mapUser(row));
});

usersRouter.post('/', requirePermission('users:write'), requireRole('admin'), (req, res) => {
  const input = parse(userInput, req.body);
  if (!input.password) throw new HttpError(400, 'password: is required when creating a user');
  const userId = `u-${randomUUID()}`;
  getDb()
    .prepare(`
      INSERT INTO users (id, name, email, phone, role, active, avatar, last_active, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 'Just added', ?)
    `)
    .run(
      userId,
      input.name,
      input.email.toLowerCase(),
      input.phone,
      input.role,
      input.active === false ? 0 : 1,
      bcrypt.hashSync(input.password, 10)
    );
  res.status(201).json(mapUser(findUser(userId)));
});

usersRouter.put('/:id', requirePermission('users:write'), requireRole('admin'), (req: AuthRequest, res) => {
  const input = parse(userInput, req.body);
  const existing = findUser(req.params.id);
  if (!existing) throw new HttpError(404, 'User not found.');
  const nextActive = input.active === false ? 0 : 1;
  assertNotSelf(req, existing.id);
  assertLastAdmin(existing, input.role, nextActive);
  const passwordHash = input.password ? bcrypt.hashSync(input.password, 10) : existing.password_hash;
  getDb()
    .prepare(`
      UPDATE users SET name = ?, email = ?, phone = ?, role = ?, active = ?, password_hash = ?
      WHERE id = ?
    `)
    .run(input.name, input.email.toLowerCase(), input.phone, input.role, nextActive, passwordHash, existing.id);
  res.json(mapUser(findUser(existing.id)));
});

usersRouter.post('/:id/toggle', requirePermission('users:write'), requireRole('admin'), (req: AuthRequest, res) => {
  const existing = findUser(req.params.id);
  if (!existing) throw new HttpError(404, 'User not found.');
  const nextActive = existing.active === 1 ? 0 : 1;
  assertLastAdmin(existing, existing.role, nextActive);
  assertNotSelf(req, existing.id);
  getDb().prepare('UPDATE users SET active = ? WHERE id = ?').run(nextActive, existing.id);
  res.json(mapUser(findUser(existing.id)));
});

usersRouter.delete('/:id', requirePermission('users:delete'), requireRole('admin'), (req: AuthRequest, res) => {
  const existing = findUser(req.params.id);
  if (!existing) throw new HttpError(404, 'User not found.');
  assertLastAdmin(existing, existing.role, 0);
  assertNotSelf(req, existing.id);
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  if (result.changes === 0) throw new HttpError(404, 'User not found.');
  res.status(204).end();
});
