import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url));

/**
 * Both entry points resolve the project root one level above their own folder:
 *   - development: <root>/server/index.ts  -> <root>
 *   - production:  <root>/dist-server/index.js -> <root>
 * Set PAYNEST_ROOT to override this when the compiled server is copied elsewhere.
 */
export const PROJECT_ROOT = process.env.PAYNEST_ROOT?.trim()
  ? path.resolve(process.env.PAYNEST_ROOT.trim())
  : path.resolve(moduleDir, '..');

export function resolveProjectPath(input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(PROJECT_ROOT, input);
}

export function getDistDir(): string {
  return path.join(PROJECT_ROOT, 'dist');
}

export function getSchemaPath(): string {
  return path.join(PROJECT_ROOT, 'docs', 'schema.sql');
}

export function getDefaultDbPath(): string {
  return path.join(PROJECT_ROOT, 'data', 'pos.db');
}
