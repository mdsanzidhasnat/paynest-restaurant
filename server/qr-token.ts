import { createHmac, timingSafeEqual } from 'node:crypto';
import { getQrTokenSecret } from './config.ts';

export interface QrTokenPayload {
  tableId: string;
  version: number;
}

/**
 * HMAC-signed, stateless table token. The version is embedded so rotating a
 * table's secret invalidates every previously issued QR code without a
 * database-wide secret rewrite. Public verification is added with QR routes.
 */
export function signTableToken(tableId: string, version: number): string {
  const payload = Buffer.from(JSON.stringify({ t: tableId, v: version })).toString('base64url');
  const signature = createHmac('sha256', getQrTokenSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

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
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      t?: unknown;
      v?: unknown;
    };
    const version = typeof parsed.v === 'number' ? parsed.v : NaN;
    if (typeof parsed.t !== 'string' || !Number.isInteger(version) || version < 1) {
      return null;
    }
    return { tableId: parsed.t, version };
  } catch {
    return null;
  }
}
