# Changelog

## 1.0.0 — 2026-11-24

First release of PayNest Restaurant as a single-service table-management application.

### Added

- Staff workspace with sign-in, dashboard, floor/table map, waiter order entry, kitchen display, menu management, billing, ingredient inventory, reports, users, settings and table QR screens.
- Separate guest menu page at `/m/:token` with category browsing, variants, cart creation, order placement and status polling. No staff session or staff navigation is loaded on that page.
- Signed table QR codes with rotation and configurable lifetime; printed codes are invalidated when a table's QR version changes.
- Public, rate-limited QR menu/order/status endpoints that validate every request, resolve prices on the server and expose only the published menu plus that table's own order status.
- Server-owned order workflow: guest orders wait in `pending_confirmation`, a waiter confirms them (or an admin enables auto-confirm), kitchen moves items `new → preparing → ready`, and serving `ready → served` deducts recipe stock.
- Billing with server-computed subtotal, VAT, service charge, discounts, dues, totals and split plans; cashier discounts are capped and payment methods are recorded without a gateway.
- Ingredient master data, per-item recipes, manual stock adjustments, low-stock alerts and a stock ledger.
- Five roles (`admin`, `manager`, `waiter`, `kitchen`, `cashier`) with a single backend permission map and permission-derived navigation.
- Integration tests built with Vitest and Supertest, component/helper tests, a native-module smoke test and a CI workflow.
- Multi-stage Docker image, optional-`.env` Compose deployment, Render service definition and Dependabot configuration.

### Fixed during final verification

- Cashier discount requests above `MAX_CASHIER_DISCOUNT_PERCENT` now return `403`; valid requests are still resolved and clamped on the server.
- Missing paths under `/assets` now return a real `404` instead of falling through to the SPA shell.
- Development and clean scripts are cross-platform (`cross-env` and a Node-based cleanup script), and `@types/node` is pinned to `20.19.43` to match the Node `20.19.0` runtime.
- The default SQLite file is now `data/restaurant.db` instead of the legacy `data/pos.db`; deployments with an existing database should set `DB_PATH` explicitly.

### Security

- Passwords are bcrypt hashes; JWTs are stored in an httpOnly `SameSite=Strict` cookie that becomes `secure` in production.
- Every `/api` route except login, health and the signed public QR routes passes through authentication and a backend permission or role check.
- Mutating `/api` requests require `application/json`; public routes are signed, scoped to one table, validated with Zod and rate limited.
- All money and counters are computed on the server. Clients cannot submit totals, VAT, service charge, paid amounts or sequence values, and discounts are clamped.
- SQL statements are parameterized. Foreign keys are enabled, destructive user guards protect the last active admin and no secret is read from the browser through `VITE_*`.
- Production startup rejects missing or short JWT/QR signing secrets. `npm audit` and `npm audit --omit=dev --audit-level=high` both reported zero vulnerabilities on 2026-11-24; see [docs/security-audit.md](./docs/security-audit.md).

### Database

- Schema version 4 in [docs/schema.sql](./docs/schema.sql) with primary and foreign keys, explicit delete rules, unique/check constraints, lookup indexes and WAL mode.
- Money is stored as INTEGER minor units (paisa); percentages are REAL values from `0..100`.
- Orders own bill numbers and totals; payments record only method and amount. Historical snapshots are kept on financial tables.
- `number_sequences` and `schema_version` support atomic numbering and idempotent migrations. Number allocation and row insertion use separate `IMMEDIATE` transactions with unique retries, so gaps are possible but duplicates are not.
- Recipes are stored per menu item; serving an item writes `stock_movements` and recomputes order/table status in one transaction.
- [docs/seed.sql](./docs/seed.sql) is generated from [src/data/seedData.ts](./src/data/seedData.ts); demo identities and relative dates come from environment-driven seed code.

### Docs

- Rewrote [README.md](./README.md) and [HowToSetup.md](./HowToSetup.md) for the restaurant product, including demo accounts, roles, QR flow, environment variables and Node/Docker installation.
- Completed [docs/api.md](./docs/api.md), added [docs/security-audit.md](./docs/security-audit.md) and updated the screenshot manifest in [docs/screenshots/README.md](./docs/screenshots/README.md).
- Updated [AGENTS.md](./AGENTS.md), [CLAUDE.md](./CLAUDE.md), [LICENSE-NOTE.md](./LICENSE-NOTE.md) and [metadata.json](./metadata.json) for the current architecture, dependencies and branding.
- Removed obsolete delivery files, stale product references and unused legacy code from the tracked tree.
