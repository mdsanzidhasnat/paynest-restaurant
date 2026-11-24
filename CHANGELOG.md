# Changelog

## Unreleased

- Fixed broken product and avatar images in production: the demo JPEGs moved from `src/assets/images/` to `public/images/` and all stored URLs now use `/images/<filename>`, which Vite copies into `dist/`. The obsolete `src/assets` copy plugin was removed from `vite.config.ts`.
- Added an idempotent startup migration in `server/migrate.ts` that rewrites legacy `/src/assets/images/...` values in `products.image` and `users.avatar` for already-deployed databases, with unit tests.
- Renamed the seed source from `src/data/mockData.ts` to `src/data/seedData.ts` and updated the seeders, generated `docs/seed.sql`, and setup docs.
- Normalized `build:server` to an explicit esbuild command using `--packages=external`, keeping `better-sqlite3` and `bcrypt` loaded from `node_modules` at runtime.
- Reports date presets now use the visitor's local date at runtime (7/14/30 days ending today) instead of fixed 2026 dates; the formatter lives in `src/utils/dates.ts` with unit tests.
- Product preset image paths were moved to `src/data/productImages.ts`; `AddProductView` no longer imports the seed module.

## 1.0.0 — 2026-11-23

### Added

- Real authentication: `POST /api/auth/login` checks bcrypt password hashes, signs a JWT, sets the httpOnly `paynest_token` cookie, and `/api/auth/me` restores the session.
- Role-based access control with a 30-permission backend map in `server/permissions.ts`, enforced by `requireAuth` and `requirePermission` in `server/middleware.ts`.
- SQLite schema in `docs/schema.sql`, applied automatically by `server/db.ts`, with WAL mode and demo seeding when the `users` table is empty.
- Component refactor: extracted `ProductTable`, `CartPanel`, and `BarcodeInput`, and moved billing helpers into `src/utils/billing.ts`.
- Tests for billing, API authentication/RBAC, and the refactored components.
- Setup, database, licensing, and screenshot guidance in `HowToSetup.md`, `docs/schema.sql`, `LICENSE-NOTE.md`, and `docs/screenshots/README.md`.
- Native-module smoke test (`scripts/smoke-native.mjs` / `npm run smoke`) for bcrypt and better-sqlite3.
- Staged, timestamped production startup logs, a public `GET /api/health` check, and a Render service definition in `render.yaml`.
- Multi-stage [Dockerfile](./Dockerfile), [docker-compose.yml](./docker-compose.yml), and `.dockerignore` for a containerised single-service deployment.
- Machine-generated [docs/seed.sql](./docs/seed.sql) via `npm run seed:sql`, and a complete endpoint/permission reference in [docs/api.md](./docs/api.md).

### Changed

- The frontend now calls the Express API through `src/api/client.ts` instead of mutating local mock state; the seed source consumed by `server/seed.ts` is now `src/data/seedData.ts`.
- Toolchain versions were aligned, `engines` and `.nvmrc` were added for Node 20.19.0, `.npmrc` was removed, and `npm ci` passes without `legacy-peer-deps`.
- Dependency cleanup removed unused direct packages and changed CORS configuration to use `CORS_ORIGIN`. `better-sqlite3` is pinned to `12.11.1` (Node 20/22 supported), `jsdom` to `28.0.0`, and `concurrently` to `9.2.5` for Node 20 compatibility; `esbuild` is now a direct devDependency.
- Production no longer runs TypeScript through `tsx`: `npm run build` bundles the server into `dist-server/index.js` with esbuild and `npm start` runs plain Node. Frontend build plugins moved to devDependencies.
- Project paths are resolved from the project root (or `PAYNEST_ROOT`) instead of the shell working directory; `PORT` defaults to `3000` and the DB default is `./data/pos.db`.
- Seeding is opt-in: demo rows are created only when `SEED_DEMO_DATA=true` and the `users` table is empty. Demo credentials come from the environment, with a random password generated and logged once when a password variable is absent. Seed dates are relative to the current date, and the seed set contains 25 products and 10 invoices.
- All direct dependencies are pinned to exact versions; the unused `@testing-library/dom` direct pin was removed and `vite` was added explicitly.
- Sales list/detail and sale creation load products and line items in batched queries instead of one query per row. Dynamic `nextNumber` SQL and the seed delete loop were replaced with fixed SQL strings. The schema adds unique SKU/barcode constraints and status/due indexes.

### Deployment

- [render.yaml](./render.yaml) defines a Singapore free-plan Node web service using `npm ci --include=dev && npm run build`, `npm run start`, and `/api/health` as its health check.
- `HowToSetup.md` documents the exact Render steps, free-plan sleep and ephemeral-filesystem limits, and using a persistent `DB_PATH` such as `/var/data/pos.db`.

### Security

- Passwords are stored only as bcrypt hashes; user creation and updates hash with cost 10.
- API role and permission checks are authoritative; frontend hiding is cosmetic only.
- Secrets are supplied through backend environment variables; no `VITE_*` variables are used and `.env.example` contains placeholders only. A missing development `JWT_SECRET` now generates a random per-process secret instead of falling back to a shared value; production requires a secret of at least 32 characters.
- User management requires both `users:*` permissions and the `admin` role. Users cannot change their own role/status or delete themselves, the last active admin cannot be removed, and unknown roles are rejected before any database write. Deactivated users' tokens are rejected on every request.
- Final `npm audit` result: `found 0 vulnerabilities` (0 critical, 0 high, 0 moderate, 0 low, 0 info). No overrides were needed.
