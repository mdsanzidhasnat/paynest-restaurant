# Security audit

Audit date: 2026-11-24

## Commands and result

| Command | Result |
|---|---|
| `npm audit` | `found 0 vulnerabilities` |
| `npm audit --omit=dev --audit-level=high` | `found 0 vulnerabilities` |

Both commands were run from the repository root against the committed `package-lock.json`. The final dependency set added dev-only `cross-env@10.1.0` and aligned `@types/node@20.19.43` with the Node `20.19.0` runtime; both audits were rerun after that change. The second command is the production-dependency gate used by [`.github/workflows/ci.yml`](../.github/workflows/ci.yml); it fails the build on any high or critical advisory in runtime dependencies.

## Related controls

- Passwords are hashed with bcrypt; JWTs are stored in an httpOnly `SameSite=Strict` cookie that becomes `secure` in production.
- Every `/api` route except `/api/health`, `/api/auth/*` and the signed `/api/public/*` routes passes through `requireAuth` and a backend permission check.
- Mutating `/api` requests require `Content-Type: application/json`; secrets are backend-only environment variables, never `VITE_*`.
- Public QR routes are signed, scoped to one table, rate limited and validate every request with Zod.
- Money totals, VAT, service charge, discounts and dues are calculated on the server; clients send only menu selections, quantities and a discount choice.
- The production service worker caches only local static shell/assets in a versioned cache. It bypasses `/api` entirely (including signed `/api/public` routes), never serves a cached API response, and keeps missing `/assets` requests as real `404`s. Helmet defaults are retained with `manifest-src 'self'` and `worker-src 'self'` added.

Re-run `npm audit` after any dependency change and update this file with the new date and result.
