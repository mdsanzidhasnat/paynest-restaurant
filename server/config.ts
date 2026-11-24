import { randomBytes } from 'node:crypto';
import { logWarn } from './log.ts';
import { getDefaultDbPath, resolveProjectPath } from './paths.ts';

let generatedSecret: string | undefined;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set in production and contain at least 32 characters.'
      );
    }
    return secret;
  }
  if (secret) return secret;
  if (!generatedSecret) {
    generatedSecret = randomBytes(32).toString('hex');
    logWarn(
      'JWT_SECRET is not set; generated a random development secret. Sessions will reset on restart.'
    );
  }
  return generatedSecret;
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || '8h';
}

export function getDbPath(): string {
  return resolveProjectPath(process.env.DB_PATH?.trim() || getDefaultDbPath());
}

export function getPort(): number {
  const value = Number(process.env.PORT);
  return Number.isFinite(value) && value > 0 ? value : 3000;
}

export function getAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS)?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured && configured.length > 0
    ? configured
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}
