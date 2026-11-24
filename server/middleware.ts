import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE, verifyToken } from './auth.ts';
import { getDb } from './db.ts';
import { HttpError } from './errors.ts';
import { permissionsForRole, roleAllows, type Permission, type Role } from './permissions.ts';

export interface AuthInfo {
  userId: string;
  role: Role;
  permissions: Permission[];
}

export interface AuthRequest extends Request {
  auth?: AuthInfo;
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new Error('Missing token');
    const payload = verifyToken(String(token));
    const row = getDb()
      .prepare('SELECT id, role, active FROM users WHERE id = ?')
      .get(payload.sub) as { id: string; role: Role; active: number } | undefined;
    if (!row || !row.active) throw new Error('Inactive user');
    req.auth = {
      userId: row.id,
      role: row.role,
      permissions: permissionsForRole(row.role),
    };
    next();
  } catch {
    next(new HttpError(401, 'Authentication required.'));
  }
}

export function requirePermission(permission: Permission) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, 'Authentication required.'));
      return;
    }
    if (!roleAllows(req.auth.role, permission)) {
      next(new HttpError(403, 'You do not have permission to do that.'));
      return;
    }
    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, 'Authentication required.'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new HttpError(403, 'Your role cannot perform this action.'));
      return;
    }
    next();
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, ...(error.details ?? {}) });
    return;
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    String((error as { code: unknown }).code).startsWith('SQLITE_CONSTRAINT')
  ) {
    res.status(409).json({ error: 'A record with that value already exists or is still referenced.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
}
