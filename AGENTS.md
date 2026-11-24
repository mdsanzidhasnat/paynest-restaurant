# AGENTS.md

Project rules for PayNest Restaurant. Read this file before changing code, configuration or docs.

## Product scope

PayNest Restaurant is a table-service system for restaurants, cafés and food courts. Implement and maintain only these areas: floor/table management, signed QR menu ordering, waiter orders, kitchen display, menu management, billing, ingredient stock, reports, users and settings. Do not add payment gateways, messaging, AI/maps/GPS, multi-branch features, delivery integrations or a native mobile app. The `/m/:token` guest page is a mobile web page, not a separate app.

The five roles are `admin`, `manager`, `waiter`, `kitchen` and `cashier`. Preserve the current branding and copy of the restaurant screens; do not reintroduce unrelated product names, marketing text, products or imagery.

## Hard rules

- Money (VAT, service charge, discounts, subtotals, totals and dues) is computed only by `server/billing.ts` and `server/order-totals.ts`. Clients never submit totals or counters. Amounts are INTEGER minor units (paisa): `55000` means `550.00`; percentages are REAL `0..100`. Screens format these values only through `formatMoney()` in `src/utils/money.ts`. Reject negative or non-numeric money and clamp discounts; cashier discounts above `MAX_CASHIER_DISCOUNT_PERCENT` are rejected with `403`.
- Ingredient stock, low-stock thresholds, recipe quantities and stock-movement deltas are REAL display-unit values rounded to at most three decimals by `server/stock.ts`. Serving, restocking and recipe writes must use that helper; never store negative or non-finite stock and never change the decimal API shape.
- Passwords are always bcrypt hashes. JWT authentication and all role/permission checks happen on the backend; frontend hiding is cosmetic only.
- Every `/api` route except `GET /api/health`, `POST /api/auth/login` and the signed `/api/public/*` routes passes through `requireAuth` and an explicit `requirePermission`/`requireRole` guard.
- Public QR routes are minimal, rate limited, Zod-validated and scoped to a signed table token. They return only the published menu and that table's own order status. Never expose cost, stock count, recipe, staff or other-table data there.
- CORS, the JSON guard and authentication apply under `/api` only. Static files and the SPA must never pass through CORS or auth. Missing `/assets` paths must return a real 404.
- All SQL is parameterized. Table/column names are never request-supplied. Keep foreign keys enabled on every connection (`server/db.ts`) and preserve primary/foreign keys, `ON DELETE` rules, `UNIQUE`/`CHECK` constraints and lookup indexes in `docs/schema.sql`.
- Generate order and bill numbers atomically with `number_sequences`, `IMMEDIATE` transactions, `UNIQUE` constraints and retry. Gaps are acceptable; duplicates are not. Counters and aggregates are server-owned and never exposed to a plain update endpoint.
- List endpoints advertised as paged accept `limit` (default `1000`, max `5000`) and `offset` (default `0`) via `server/http.ts`. Use JOINs or chunked `IN` lists, never N+1 queries. Use runtime dates; seed data uses dates relative to the current day.
- No secrets in the repository. Keep `.env.example` with placeholders only, supply secrets through environment variables and never prefix a secret with `VITE_`. Production refuses to start without `JWT_SECRET` and `QR_TOKEN_SECRET` of at least 32 characters. The auth cookie is httpOnly, `sameSite: 'strict'`, `path: '/'`, and `secure` in production. Mutating requests require `application/json`, except `/api/auth/logout`.
- Node `>=20.19.0` and npm `>=10` are required. Keep `.nvmrc`, `package.json` engines, `Dockerfile` and `@types/node` aligned. Dependency versions are exact pins.
- Add Vitest/Supertest coverage for every new endpoint, role rule and billing calculation. After every change run `npm run build`, `npm run lint` and `npm test`; fix failures before moving on.
- Use only real file paths from this repository. If something cannot be verified, say so; never claim a test ran when it did not.

## Repository architecture

- **Root:** `src/` frontend, `server/` API, `docs/` (`schema.sql`, `seed.sql`, `api.md`, `security-audit.md` and `screenshots/`), `scripts/` (`generate-seed-sql.ts`, `smoke-native.mjs`), `.github/` (Dependabot and CI), plus `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `.nvmrc`, `.gitignore`, `render.yaml`, `Dockerfile`, `docker-compose.yml` and `.dockerignore`.
- **Root documents:** `README.md`, `HowToSetup.md`, `CHANGELOG.md`, `LICENSE-NOTE.md`, `AGENTS.md`, `CLAUDE.md` and `metadata.json`.
- **Frontend:** `src/main.tsx` chooses the guest tree or the staff tree. `src/components/customer/CustomerMenuPage.tsx` renders `/m/:token` outside `AuthProvider`; the staff tree wraps `src/App.tsx` in `AuthProvider` from `src/auth/AuthContext.tsx`. `src/api/client.ts` owns all `/api` calls. UI code lives in `src/components/{views,common,layout,customer}/`; shared UI colours and print styles are in `src/index.css`. Types are in `src/types/domain.ts`; role navigation is in `src/utils/navigation.ts`; formatting lives in `src/utils/money.ts` and `src/utils/dates.ts`. `src/data/seedData.ts` is the seed source and `src/data/productImages.ts` lists local preset images.
- **Backend:** `server/index.ts` starts the service and serves `dist/`; `server/app.ts` mounts routers; `server/config.ts`, `server/env.ts`, `server/paths.ts` and `server/log.ts` handle environment, paths and logs. `server/db.ts` opens SQLite; `server/migrate.ts` applies schema version 4. `server/auth.ts`, `server/middleware.ts` and `server/permissions.ts` implement security. `server/validate.ts` and the route files validate input. `server/mappers.ts` maps user rows. `server/billing.ts`, `server/order-totals.ts`, `server/order-state.ts`, `server/stock.ts`, `server/numbering.ts` and `server/qr-token.ts` own money, stock precision, state transitions, numbering and QR signatures. `server/seed.ts`, `server/seed-cli.ts` and `scripts/generate-seed-sql.ts` handle demo data. `server/routes/` contains `auth.ts`, `public.ts`, `tables.ts`, `menu.ts`, `orders.ts`, `kitchen.ts`, `billing.ts`, `inventory.ts`, `reports.ts`, `users.ts` and `settings.ts`.
- **Assets:** images referenced by string path live in `public/images/` and use `/images/<filename>`. Vite copies them into `dist/images/`. Do not use `/src/assets/...`. No remote images or fonts are fetched at runtime.

## Frontend routing and screens

- There is no React Router. `NavSection` is defined in `src/types/domain.ts`; `activeSection` and the selected `activeOrder` live in `src/App.tsx`. `src/components/layout/Sidebar.tsx` and `TopBar.tsx` call `onNavigate`.
- `src/App.tsx` conditionally renders the views in `src/components/views/`: login, dashboard, tables, waiter order, kitchen, menu, billing, inventory, reports, users, settings and table QR.
- `homeForRole()` in `src/utils/navigation.ts` sends admin/manager to dashboard, waiter to tables, kitchen to the kitchen display and cashier to billing. `allowedSections()` derives visible navigation from permissions; `Sidebar.tsx` filters its items with that list. Navigation is cosmetic, never an authorization boundary.
- `/m/:token` is matched in `src/main.tsx` and renders the guest page without staff auth state. Staff links use the signed `path` returned by `/api/tables/:id/qr`.

## API structure

- `src/api/client.ts` calls relative `/api` URLs with `credentials: 'same-origin'`; a 401 clears local auth through a handler registered by `AuthContext.tsx`. Response mapping converts raw snake_case fields such as `floor_name` and `age_minutes` into the UI camelCase types.
- `server/app.ts` mounts `GET /api/health`, `/api/auth` and `/api/public` before `requireAuth`. Login and health are public; `POST /api/auth/logout` and `GET /api/auth/me` require authentication. The nine domain routers are mounted after `requireAuth`. Unknown `/api` paths return a JSON 404.
- CORS is configured only under `/api` and always allows same-origin requests. `CORS_ORIGIN` is optional; `CORS_ORIGINS` is a fallback. Static files are served in `server/index.ts` after the API app is built.
- Every mutating `/api` method (`POST`, `PUT`, `PATCH`, `DELETE`) requires `Content-Type: application/json`; the only exception is logout. Zod schemas in the route files validate bodies. `server/http.ts` provides pagination and the JSON guard.
- Use `requirePermission` for new privileged routes and `requireRole('admin')` for user-management routes. Define new permissions in `PERMISSION_MAP` in `server/permissions.ts`, not in UI code. See `docs/api.md` for the full route and permission reference.

## Authentication and RBAC

- `src/components/views/LoginView.tsx` calls `onSignIn`, mapped to `AuthContext.login` → `api.login`. `POST /api/auth/login` checks an active user with `bcrypt.compare`, signs a JWT and sets `paynest_token`.
- `requireAuth` in `server/middleware.ts` re-reads the user on every request, so tokens for inactive or deleted users stop working immediately. `AuthProvider` calls `GET /api/auth/me` on mount to restore the session.
- `PERMISSION_MAP` is the single authorization map. `permissionsForRole()` and `roleAllows()` derive permissions; `requirePermission()` and `requireRole()` enforce them. It contains only restaurant permissions. User routes additionally require the `admin` role: users cannot change their own role/status or delete themselves, managers cannot create admins, and the last active admin cannot be removed.
- The frontend receives the permission list from `/api/auth/me` and uses `can()` only to hide or disable controls. Never treat frontend hiding as authorization.

## QR token design

- `server/qr-token.ts` signs a base64url JSON payload `{ t: tableId, v: qrSecretVersion, exp: unixSeconds }` with HMAC-SHA256 using the backend-only `QR_TOKEN_SECRET`. The signature covers the expiry so guests cannot extend it.
- Verification checks signature with `timingSafeEqual`, payload shape and expiry; the caller must also check the token version against the table's current `qr_secret_version`. `POST /api/tables/:id/qr/rotate` increments that version and invalidates every previously printed code.
- `QR_TOKEN_TTL_SECONDS` defaults to one year. `GET /api/tables/:id/qr` returns a token/path/URL for the staff **Table QR** screen. Printed codes open `src/components/customer/CustomerMenuPage.tsx` through `/m/:token`.
- Public routes accept the token as a query parameter or body field, enforce per-IP and per-table limits and never accept table ids from guests. `GET /api/public/menu` returns only available categories/items/variants; `POST /api/public/orders` creates a server-priced order; `GET /api/public/orders/:id` returns status for that token's table only.

## Order state machine and stock

- Waiter-created orders start at `new`. Guest orders start at `pending_confirmation` and are excluded from kitchen tickets, billing, item changes and reports until `POST /api/orders/:id/confirm` moves them to `new`. An admin can enable `settings.auto_confirm_public_orders` to skip waiter confirmation.
- Item statuses are `new`, `preparing`, `ready`, `served` and `cancelled`. Forward moves are `new → preparing → ready → served`; cancellation is a separate guarded transition with a required reason. Backward moves require `orders:override` (admin/manager). Invalid moves return 409.
- Kitchen routes allow `new → preparing → ready`; the waiter/order route performs `ready → served`. Every successful transition writes an `order_item_events` row used for timers and audit. `server/order-state.ts` recomputes order status from non-cancelled lines and derives table status from open orders/bills.
- Serving an item deducts its recipe ingredients in one `IMMEDIATE` transaction, writes negative `stock_movements`, prevents double deduction on a served-then-reversed item, and returns 409 with `{ lowStock: true, ingredientId }` when stock is short. Recipe quantities are per menu item, not per variant. Table status is `free`, `occupied` or `bill_pending` and is never written directly by a client.

## Database layer

- `server/db.ts` opens `better-sqlite3` from `DB_PATH`, enables `PRAGMA foreign_keys = ON`, enables WAL when the data directory is writable, applies migrations and seeds only when the users table is empty and `SEED_DEMO_DATA=true`. Paths resolve from the project root or `PAYNEST_ROOT`.
- `docs/schema.sql` is the source schema. `server/migrate.ts` stores the current version in `schema_version`; version 4 includes `settings.auto_confirm_public_orders`, the `pending_confirmation` order status, `idx_orders_table_status` and the restaurant tables. It also rewrites legacy `/src/assets/images/...` values in `menu_items.image` and `users.avatar` to `/images/...` on startup.
- `src/data/seedData.ts` exports the restaurant seed constants. `server/seed.ts` reads demo emails/passwords from the environment; a missing password generates a random value logged once in plaintext and stored only as a hash. `npm run seed` is destructive; `npm run seed:sql` regenerates `docs/seed.sql`.
- Financial tables keep historical snapshots. Prefer deactivating users over deleting them.

## Conventions and verification

- Preserve existing UI copy, Tailwind classes, layout and colours when refactoring; move code without redesigning it.
- Keep types in `src/types/domain.ts`, money/date helpers in `src/utils/`, API calls in `src/api/client.ts`, reusable UI in `src/components/common/` and validation in `server/validate.ts` or route-local Zod schemas.
- Do not read secrets through `import.meta.env.VITE_*`. `npm ci` installs exact pins from `package-lock.json`.
- Commands: `npm run dev` (API on 3001, Vite on 3000), `npm run build`, `npm start`, `npm run lint` (`tsc --noEmit`), `npm test` (Vitest), `npm run smoke` (native modules), `npm run seed`, `npm run seed:sql`, `npm audit`.
- CI runs `npm ci`, lint, build, tests and `npm audit --omit=dev --audit-level=high`. Keep `.github/workflows/ci.yml`, `docs/security-audit.md` and dependency pins in sync with dependency changes.
- `render.yaml` defines the single Node web service; `GET /api/health` is the health endpoint. `Dockerfile`, `docker-compose.yml` and `.dockerignore` define the container deployment with a named SQLite volume. Static-only hosting cannot run the backend.
- Update the relevant docs (`README.md`, `HowToSetup.md`, `docs/api.md`, `CHANGELOG.md`, `LICENSE-NOTE.md`) whenever behaviour, endpoints or dependencies change, then commit with a clear message.
