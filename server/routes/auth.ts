import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { clearAuthCookie, setAuthCookie, signToken } from '../auth.ts';
import { getDb } from '../db.ts';
import { HttpError } from '../errors.ts';
import { mapUser } from '../mappers.ts';
import { asyncHandler, requireAuth, type AuthRequest } from '../middleware.ts';
import { parse } from '../validate.ts';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const row = getDb()
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase()) as Record<string, any> | undefined;

    const valid =
      !!row && row.active === 1 && (await bcrypt.compare(password, row.password_hash));
    if (!valid) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const token = signToken({ sub: row.id, role: row.role });
    setAuthCookie(res, token);
    res.json(mapUser(row));
  })
);

authRouter.post('/logout', requireAuth, (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.auth?.userId) as Record<string, any> | undefined;
  if (!row || !row.active) {
    throw new HttpError(401, 'Authentication required.');
  }
  res.json(mapUser(row));
});
