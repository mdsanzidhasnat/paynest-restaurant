import { createHmac, timingSafeEqual } from 'node:crypto';
import { getQrTokenSecret, getQrTokenTtlSeconds } from './config.ts';

export interface QrTokenPayload {
  tableId: string;
  version: number;
  /** Unix seconds; printed codes are long-lived but still expire. */
  expiresAt: number;
}

interface SignedPayload {
  t?: unknown;
  v?: unknown;
  exp?: unknown;
}

/**
 * HMAC-signed, stateless table token. The version is embedded so rotating a
 * table's secret invalidates every previously issued QR code without a
 * database-wide secret rewrite. The signature also covers the expiry, so a
 * guest cannot extend a printed code's lifetime.
 */
export function signTableToken(
  tableId: string,
  version: number,
  expiresAt: number = Math.floor(Date.now() / 1000) + getQrTokenTtlSeconds()
): string {
  const payload = Buffer.from(
    JSON.stringify({ t: tableId, v: version, exp: expiresAt })
  ).toString('base64url');
  const signature = createHmac('sha256', getQrTokenSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Verifies signature, payload shape and expiry; table version is checked by the caller. */
export function verifyTableToken(token: string): QrTokenPayload | null {
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', getQrTokenSecret()).update(payload).digest('base64url');
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedPayload;
    const version = typeof parsed.v === 'number' ? parsed.v : NaN;
    const expiresAt = typeof parsed.exp === 'number' ? parsed.exp : NaN;
    if (
      typeof parsed.t !== 'string' ||
      !Number.isInteger(version) ||
      version < 1 ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { tableId: parsed.t, version, expiresAt };
  } catch {
    return null;
  }
}
