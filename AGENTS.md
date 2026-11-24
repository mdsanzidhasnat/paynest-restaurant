# AGENTS.md

Project rules for all later work on PayNest Restaurant. These rules apply to every implementation step in this repository.

## Product transition note (2026-11-24)

This repository has been converted from the old retail POS into a restaurant management system
(tables, QR menu ordering, waiter orders, kitchen display, menu management, billing, ingredient
stock, reports, users and settings). The temporary `docs/PLAN.md` was removed after the conversion.

- The completed conversion scope is the restaurant functional areas: tables, QR menu ordering,
  waiter orders, kitchen display, menu management, billing, ingredient inventory, and reports/roles;
  do not add payment gateways, messaging, AI/maps/GPS, multi-branch, delivery integrations or a mobile app.
- The old rule about preserving existing screens' visual design, colours and copy applies only to
  legacy code that has not yet been replaced. New and rebranded screens intentionally change copy
  and branding; do not carry over old product names, marketing text or grocery seed data.
- The five roles are `admin`, `manager`, `waiter`, `kitchen`, `cashier`. Money (VAT, service charge,
  discounts, totals, dues) is always computed on the server by `server/billing.ts`; clients never
  send totals or counters. Money is stored as INTEGER minor units (paisa); percentages are REAL
  0..100. The auth cookie uses `sameSite: 'strict'`.
- Backend API phase implemented: nine domain routers under `server/routes/` for tables, menu,
  orders, kitchen, billing, inventory, reports, users and settings. The unauthenticated
  `server/routes/public.ts` router adds signed QR menu/order/status routes, mounted before
  `requireAuth`; login, health and these public routes are the only unauthenticated `/api` paths.
  Guest orders start in `pending_confirmation` and are excluded from kitchen/billing/reports until
  a waiter confirms them. `/m/:token` is the separate mobile guest page; `table-qr` is the staff
  screen. `QR_TOKEN_TTL_SECONDS` controls printed-code lifetime; no `VITE_*` secret is used.
- Database phase implemented deviations: money is INTEGER minor units, recipe quantities are per
  menu item (not per variant), `orders` owns bill numbers and totals while `payments` records only
  the selected method and amount, and `schema_version`/`number_sequences` support migrations and
  atomic numbering. Schema v4 adds `settings.auto_confirm_public_orders`, the
  `pending_confirmation` order status and `idx_orders_table_status`. Number allocation and row
  insertion use separate IMMEDIATE transactions on UNIQUE retry: gaps are possible, duplicates never are.
- The repository-specific rules below remain in force where they do not conflict with this note;
  where they conflict, this note takes precedence.

## Hard rules

- Do not change the visual design, colours, layout or copy of existing screens. Refactors (including component splits) must preserve the current markup, Tailwind classes, headings, labels, button text, toasts and placeholder text exactly; only move code.
- No real secrets in the repo. Secrets must be supplied only through environment variables; keep `.env.example` with placeholders only; never prefix a secret with `VITE_`. Vite embeds `VITE_*` values into browser code.
- Passwords are always hashed with bcrypt. Role checks always happen on the backend; frontend hiding is only cosmetic.
- After every change run: `npm run build`, `npm run lint`, `npm test`. Fix failures before moving on.
- Use only real file paths found in this repo; never invent paths.

## Repository architecture

- **Root:** `src/` frontend, `server/` API, `docs/` (`schema.sql`, `seed.sql`, `api.md`, screenshot notes), and `scripts/` (`generate-seed-sql.ts`, `smoke-native.mjs`), plus build/hosting config in `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `render.yaml`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `index.html`, `.env.example`, `.nvmrc`, and `.gitignore`. Docs at the root are `README.md`, `HowToSetup.md`, `CHANGELOG.md`, `LICENSE-NOTE.md`, and this file.
- **Frontend folders:** `src/api/` (`client.ts` for all `/api` calls), `src/auth/` (`AuthContext.tsx`), `src/components/` (`charts/`, `common/`, `layout/`, `modals/`, `views/`), `src/data/` (`seedData.ts` for seed data, `productImages.ts` for preset image paths), `src/test/`, `src/types/pos.ts`, and `src/utils/` (`format.ts`, `billing.ts`, `billing.test.ts`, `dates.ts`, `dates.test.ts`). Image assets live in `public/images/` and are referenced as `/images/<filename>`.
- **Backend folders:** `server/index.ts` (entry point), `server/app.ts` (Express app and route mounting), `server/config.ts` (environment), `server/db.ts` (SQLite), `server/seed.ts` and `server/seed-cli.ts`, `server/auth.ts`, `server/middleware.ts`, `server/permissions.ts`, `server/mappers.ts`, `server/validate.ts`, `server/errors.ts`, `server/http.ts` (pagination and JSON guard), `server/billing.ts` and `server/order-totals.ts` (authoritative money), `server/order-state.ts` (state machine and stock), `server/qr-token.ts` (HMAC table tokens), `server/numbering.ts` (atomic numbers), and `server/routes/` for the API routers.
- **Entry point:** `src/main.tsx` mounts `src/App.tsx`, wraps it in `AuthProvider`, and imports `src/index.css`.

## Frontend routing

- There is no React Router. Routing is state-driven: `NavSection` is defined in `src/types/pos.ts`, `activeSection` lives in `src/App.tsx`, and `Sidebar.tsx` / `TopBar.tsx` call `onNavigate`.
- `src/App.tsx` conditionally renders views from `src/components/views/`.
- Special in-app transitions are handled in `src/App.tsx`: `products` → `add-product` for add/edit, and `sales-history` → `invoice-preview` for invoice inspection.
- `allowedSections` in `src/App.tsx` derives visible navigation from permissions; `Sidebar.tsx` filters its `navItems` with that list.

## API structure

- `src/api/client.ts` calls `/api` with `credentials: 'same-origin'`; a 401 response clears the local user through a handler registered by `AuthContext.tsx`.
- `server/app.ts` mounts `/api/auth` as the only unauthenticated router. Every other `/api` route passes through `requireAuth`.
- Mutating `/api` requests require `application/json` (`requireJson` in `server/http.ts`); the only exception is `/api/auth/logout`.
- Routers live in `server/routes/`: `auth.ts`, `tables.ts`, `menu.ts`, `orders.ts`, `kitchen.ts`, `billing.ts`, `inventory.ts`, `reports.ts`, `users.ts`, and `settings.ts`. Request validation is in `server/validate.ts`, and row-to-UI mapping is in `server/mappers.ts`.
- Use Zod schemas in the route files for new request bodies and `requirePermission` for new protected routes.

## Authentication flow

- `src/components/views/LoginView.tsx` calls `onSignIn`, which maps to `AuthContext.login` → `api.login`.
- `POST /api/auth/login` validates the email, checks the active user with `bcrypt.compare`, signs a JWT, and sets `paynest_token` through `setAuthCookie`.
- The cookie is httpOnly, `sameSite: 'strict'`, `path: '/'`, and `secure` when `NODE_ENV === 'production'`.
- `AuthProvider` calls `/api/auth/me` on mount to restore the user; 401 clears local auth state.
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `DB_PATH`, `PORT`, `CORS_ORIGIN`, `QR_TOKEN_SECRET`, and `MAX_CASHIER_DISCOUNT_PERCENT` are read in `server/config.ts`. Production startup rejects a missing or short (`<32`) `JWT_SECRET`; outside production an unset secret generates a random per-process value with a warning.

## Role-based access control

- The single authorization map is `server/permissions.ts` (`PERMISSION_MAP`). It defines all five roles (`admin`, `manager`, `waiter`, `kitchen`, `cashier`) and their permission lists. Deprecated retail aliases remain in the map for compatibility only; no screen or endpoint may use them.
- `server/middleware.ts` enforces it with `requireAuth`, `requirePermission`, and `requireRole`; failures return 401 or 403.
- The frontend receives the resulting permission list from `/api/auth/me` and uses `can()` in `AuthContext.tsx` only to hide or disable controls. Never treat frontend hiding as authorization.

## Database layer

- `server/db.ts` opens `better-sqlite3`, enables foreign keys and WAL mode, applies `docs/schema.sql`, and seeds demo rows only when `SEED_DEMO_DATA=true` and the `users` table is empty.
- `src/data/seedData.ts` is the seed source imported by `server/seed.ts`; it is not the live runtime store. Demo emails/passwords come from environment variables; missing passwords generate a random value logged once in plaintext and stored only as a bcrypt hash. `server/migrate.ts` rewrites legacy `/src/assets/images/...` values in `menu_items.image` and `users.avatar` to `/images/...` on every startup. The current schema version is 4.
- `npm run seed` resets and re-seeds all seeded tables through `server/seed-cli.ts`. Treat it as destructive. `npm run seed:sql` regenerates `docs/seed.sql` from the same mock data for review/import into an empty database.
- Financial tables keep historical snapshots; prefer deactivating users over deleting them.

## Build and serve flow

- `npm ci` installs from `package-lock.json`. Node `>=20.19.0` and npm `>=10` are required.
- `npm run dev` starts the API and Vite together; Vite proxies `/api` to `API_TARGET` (default `http://127.0.0.1:3001`).
- `npm run build` runs Vite, copies `public/` (including `public/images/`) into `dist/` automatically, and bundles `server/index.ts` into `dist-server/index.js` with esbuild (`npm run build:server`, `--packages=external` so native modules load from `node_modules`).
- `npm start` runs `node dist-server/index.js`. Production-first defaults apply when the host does not set `NODE_ENV`; `PORT` defaults to `3000`, `DB_PATH` to `./data/pos.db`, and paths resolve from the project root or `PAYNEST_ROOT`. The server serves both the API and `dist/`; static-only hosting cannot run it.
- `npm run smoke` checks the bcrypt and better-sqlite3 native modules. `npm run lint` runs `tsc --noEmit`; `npm test` runs Vitest with `vitest.config.ts`. Keep all checks green.
- [render.yaml](./render.yaml) is the Render Node-service definition; `GET /api/health` is the public health endpoint.
- [Dockerfile](./Dockerfile) and [docker-compose.yml](./docker-compose.yml) provide the containerised single-service target; `.dockerignore` keeps local secrets and build output out of the image. Run `docker compose up --build` and check `/api/health` before considering Docker verified.
- Dependency versions in `package.json` are exact pins; regenerate `package-lock.json` with `npm install` and verify with `npm ci --include=dev` and `npm audit` when dependencies change.

## Conventions

- Preserve existing UI copy, Tailwind classes, layout, and colours when refactoring; move code without redesigning it.
- Keep secrets in backend environment variables and placeholders in `.env.example`; never read secrets through `import.meta.env.VITE_*`.
- Add backend permission checks for new privileged endpoints, not just UI conditions.
- Keep types in `src/types/pos.ts`, formatting/billing helpers in `src/utils/`, and API calls in `src/api/client.ts`.
- Use real paths from this repository and update the relevant documentation (`README.md`, `HowToSetup.md`, `docs/api.md`, `CHANGELOG.md`, `LICENSE-NOTE.md`) when behaviour, endpoints, or dependencies change.
