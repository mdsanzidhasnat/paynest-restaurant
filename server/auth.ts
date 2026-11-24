import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtExpiresIn, getJwtSecret } from './config.ts';
import type { Role } from './permissions.ts';

export const AUTH_COOKIE = 'paynest_token';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn() as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string' || !decoded.sub || !decoded.role) {
    throw new Error('Invalid token payload');
  }
  return { sub: String(decoded.sub), role: decoded.role as Role };
}

function cookieOptions(token?: string): Record<string, unknown> {
  const decoded = token ? (jwt.decode(token) as { exp?: number } | null) : null;
  const maxAge = decoded?.exp ? Math.max((decoded.exp - Math.floor(Date.now() / 1000)) * 1000, 0) : undefined;
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, cookieOptions(token));
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}
