import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errors.ts';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

export interface Pagination {
  limit: number;
  offset: number;
}

/** Validated list pagination: default 1000, maximum 5000, never negative. */
export function pagination(req: Request): Pagination {
  const limit = Number(req.query.limit ?? DEFAULT_LIMIT);
  const offset = Number(req.query.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, 'limit must be an integer between 1 and 5000.');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new HttpError(400, 'offset must be a non-negative integer.');
  }
  return { limit, offset };
}

/** All mutating API requests must declare a JSON content type. */
export function requireJson(req: Request, _res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/auth/logout') {
    if (!req.is('application/json')) {
      next(new HttpError(415, 'Mutating requests must send Content-Type: application/json.'));
      return;
    }
  }
  next();
}

export function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function now(): string {
  return new Date().toISOString();
}
