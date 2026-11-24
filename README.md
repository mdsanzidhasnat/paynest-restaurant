# PayNest Restaurant

PayNest Restaurant is a table-service restaurant management system: floor/table management, QR menu
ordering, waiter orders, a kitchen display, server-computed billing, ingredient stock and reports.
It pairs a React 19 / TypeScript front end with an Express API and SQLite persistence. The database,
authenticated API, staff screens and guest QR ordering are complete.

**Live demo:** [Paste your live demo URL here] — replace this placeholder with your deployed URL before publishing.

## Demo logins

Demo accounts are created only when `SEED_DEMO_DATA=true` and the `users` table is empty. Email
addresses and passwords come from environment variables for all five roles. When a password
variable is missing, a random password is generated and shown once in the startup log.

| Role | Email (environment variable) | Password (environment variable) |
|---|---|---|
| Admin | `ADMIN_EMAIL` | `ADMIN_PASSWORD` |
| Manager | `MANAGER_EMAIL` | `MANAGER_PASSWORD` |
| Waiter | `WAITER_EMAIL` | `WAITER_PASSWORD` |
| Kitchen | `KITCHEN_EMAIL` | `KITCHEN_PASSWORD` |
| Cashier | `CASHIER_EMAIL` | `CASHIER_PASSWORD` |

See [HowToSetup.md](./HowToSetup.md#demo-users) for the password used by your own demo. Set a strong `JWT_SECRET` before any non-demo deployment.

## Features

The staff app and guest page use the same restaurant API. Money is stored as INTEGER minor units
(paisa) and every total is computed by the server; the client only formats and displays it.

- **Role-based staff workspace** — bcrypt login with an httpOnly `SameSite=Strict` cookie, five roles, and backend permission checks. Admin/manager start on the dashboard, waiter on tables, kitchen on the kitchen display and cashier on billing. Navigation is hidden cosmetically; the API remains authoritative. See [auth.ts](./server/routes/auth.ts), [permissions.ts](./server/permissions.ts), and [navigation.ts](./src/utils/navigation.ts).
- **Tables, QR menu and guest orders** — floor tabs and table cards, printable signed table codes, a mobile-first `/m/:token` guest page, and waiter confirmation of pending QR orders. Guests see only available menu data. See [tables.ts](./server/routes/tables.ts), [public.ts](./server/routes/public.ts), and [CustomerMenuPage.tsx](./src/components/customer/CustomerMenuPage.tsx).
- **Waiter ordering and kitchen display** — menu categories, variants, notes, running tickets, send-to-kitchen, table transfers, New/Preparing/Ready columns, elapsed timers and optional sound (off by default). Tickets poll the API. See [orders.ts](./server/routes/orders.ts), [kitchen.ts](./server/routes/kitchen.ts), and [order-state.ts](./server/order-state.ts).
- **Server-owned billing** — bill request, role-limited discounts, equal/item splits, payment methods, a print stylesheet, and dues returned by the API. No gateway is integrated. See [billing.ts](./server/routes/billing.ts), [server/billing.ts](./server/billing.ts), and [BillSummary.tsx](./src/components/common/BillSummary.tsx).
- **Menu and ingredient inventory** — categories, items, variants, availability, local image picker, per-item recipes, stock ledger, adjustments and low-stock alerts. See [menu.ts](./server/routes/menu.ts) and [inventory.ts](./server/routes/inventory.ts).
- **Reports, users and settings** — runtime 7/14/30-day presets, daily sales, top items and table turnover, admin-only staff management, and singleton restaurant settings. See [reports.ts](./server/routes/reports.ts), [users.ts](./server/routes/users.ts), [settings.ts](./server/routes/settings.ts), and [dates.ts](./src/utils/dates.ts).

## Tech stack

- **Frontend:** React 19, TypeScript 7, Vite 8, Tailwind CSS 4, Lucide icons, `qrcode.react` (pinned) for local QR rendering.
- **Backend:** Express 4, `better-sqlite3`, bcrypt, `jsonwebtoken`, Helmet, CORS, cookie-parser, `express-rate-limit`, Zod, and dotenv; bundled with esbuild for production and run with plain Node. `tsx` is development-only.
- **Tests:** Vitest 4, Testing Library, jsdom, and Supertest.
- **Runtime:** Node `>=20.19.0` and npm `>=10`; see [.nvmrc](./.nvmrc) and [package.json](./package.json).

## Quick start

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` for the staff app. Use **Table QR** in the sidebar to generate and print a table code; scanning it opens the guest page at `/m/:token`. The API listens on `http://localhost:3001` by default and Vite proxies `/api` to it. See [HowToSetup.md](./HowToSetup.md) for production, seeding, deployment, and troubleshooting.

## Screenshots

Screenshot files are not committed yet. Add the files listed in [docs/screenshots/README.md](./docs/screenshots/README.md), then these references will render:

| Screen | Image |
|---|---|
| Login | `docs/screenshots/login.png` |
| Dashboard | `docs/screenshots/dashboard.png` |
| Tables | `docs/screenshots/tables.png` |
| Waiter order | `docs/screenshots/waiter-order.png` |
| Kitchen display | `docs/screenshots/kitchen.png` |
| Billing | `docs/screenshots/billing.png` |
| Reports | `docs/screenshots/reports.png` |

## Database

SQLite is used through [server/db.ts](./server/db.ts). The schema in [docs/schema.sql](./docs/schema.sql) is applied on first start, the database is seeded only when the `users` table is empty, and WAL mode is enabled when the data directory is writable. `DB_PATH` controls the file location; paths resolve from the project root (or `PAYNEST_ROOT`).

| Area | Tables | Purpose |
|---|---|---|
| Access | `users` | Login identity, five-value role enum, active flag, and bcrypt hash |
| Configuration | `settings` | Restaurant name, VAT %, service charge %, currency and receipt setup |
| Dining room | `floors`, `tables` | Floor/area map, table number per floor, QR secret version and status |
| Menu | `menu_categories`, `menu_items`, `item_variants` | Categories, prices, images, availability, prep station and variants |
| Inventory | `ingredients`, `recipe_items`, `stock_movements` | Stock, thresholds, per-item recipes and the stock ledger |
| Orders | `orders`, `order_items` | Atomic order/bill numbers, server-owned totals and item snapshots |
| Payments | `payments`, `bill_splits` | Recorded payment method/amount and server-computed split plans |
| Kitchen | `order_item_events` | Per-item status history used for kitchen timers and audit |
| Tables | `table_transfers` | Server-owned history of waiter table transfers |
| Reporting | `daily_sales` | Daily sales snapshots used by dashboard and reports |
| Internals | `schema_version`, `number_sequences` | Idempotent migration tracking and atomic numbering counters |

### Schema summary

| Table | Key columns | Foreign keys | Indexes | Delete rule |
|---|---|---|---|---|
| `users` | `id`, `email` (unique), `role`, `password_hash` | — | `UNIQUE(email)`, `idx_users_role_active` | — |
| `settings` | `id = 1`, `restaurant_name`, `vat_percent`, `service_charge_percent`, `currency_symbol`, `auto_confirm_public_orders` | — | `PRIMARY KEY(id)` | — |
| `floors` | `id`, `name` (unique), `sort_order` | — | `UNIQUE(name)`, `idx_floors_sort_order` | — |
| `tables` | `id`, `number`, `status`, `qr_secret_version` | `floor_id → floors` | `UNIQUE(floor_id, number)`, `idx_tables_floor`, `idx_tables_status` | `RESTRICT` |
| `menu_categories` | `id`, `name` (unique), `sort_order` | — | `UNIQUE(name)`, `idx_menu_categories_sort_order` | — |
| `menu_items` | `id`, `price`, `image`, `available`, `prep_station` | `category_id → menu_categories` | `UNIQUE(category_id, name)`, `idx_menu_items_category`, `idx_menu_items_available`, `idx_menu_items_prep_station` | `RESTRICT` |
| `item_variants` | `id`, `name`, `price` | `menu_item_id → menu_items` | `UNIQUE(menu_item_id, name)`, `idx_item_variants_item` | `CASCADE` |
| `ingredients` | `id`, `name` (unique), `unit`, `stock`, `low_stock_threshold` | — | `UNIQUE(name)`, `idx_ingredients_stock_threshold` | — |
| `recipe_items` | `menu_item_id`, `ingredient_id`, `quantity` | `menu_item_id → menu_items`, `ingredient_id → ingredients` | composite PK, `idx_recipe_items_ingredient` | `CASCADE` / `RESTRICT` |
| `orders` | `id`, `order_number`, `bill_number`, `source`, `status` (including `pending_confirmation`), totals, `payment_status`, `created_at` | `table_id → tables`, `opened_by → users` | both numbers unique, `idx_orders_table`, `idx_orders_table_status`, `idx_orders_opened_by`, `idx_orders_status`, `idx_orders_created_at` | `RESTRICT` |
| `order_items` | `id`, `quantity`, `notes`, `status`, price snapshots | `order_id → orders`, `menu_item_id → menu_items`, `variant_id → item_variants` | `idx_order_items_order`, `idx_order_items_menu_item`, `idx_order_items_variant`, `idx_order_items_status` | `CASCADE` / `RESTRICT` |
| `payments` | `id`, `method`, `amount` | `order_id → orders`, `recorded_by → users` | `idx_payments_order` | `RESTRICT` |
| `bill_splits` | `id`, `label`, `amount`, `method`, `paid_at` | `order_id → orders` | `UNIQUE(order_id, label)`, `idx_bill_splits_order` | `RESTRICT` |
| `order_item_events` | `order_item_id`, `from_status`, `to_status`, `actor_id` | `order_item_id → order_items`, `actor_id → users` | `idx_order_item_events_item`, `idx_order_item_events_created` | `CASCADE` / `RESTRICT` |
| `table_transfers` | `id`, `from_table_id`, `to_table_id`, `moved_by` | `order_id → orders`, tables, `moved_by → users` | `idx_table_transfers_order`, `idx_table_transfers_to_table` | `CASCADE` / `RESTRICT` |
| `stock_movements` | `id`, `quantity`, `reason` | `ingredient_id → ingredients`, `order_item_id → order_items`, `created_by → users` | `UNIQUE(order_item_id, ingredient_id, reason)`, `idx_stock_movements_ingredient`, `idx_stock_movements_order_item`, `idx_stock_movements_created_by` | `RESTRICT` |
| `daily_sales` | `sales_date`, `sales`, `orders` | — | `UNIQUE(sales_date)` | — |

`docs/schema.sql` opens with the rationale for every index. `PRAGMA foreign_keys = ON` is set on every connection, migrations in [server/migrate.ts](./server/migrate.ts) are idempotent, and order/bill numbers are allocated in an `IMMEDIATE` transaction with retry on UNIQUE conflicts.

## Roles and permissions

The authoritative map is [server/permissions.ts](./server/permissions.ts). The backend checks it with `requirePermission` in [server/middleware.ts](./server/middleware.ts); the frontend only hides controls.

| Role | Backend permissions | Main areas reachable |
|---|---|---|
| Admin | Full administration: staff, settings, menu, floors, stock and reports | Every area |
| Manager | Menu, tables, stock, orders and reports; cannot create admins | Dashboard, management and floor operations |
| Waiter | Table/order screens and bill requests | Tables, waiter order and billing |
| Kitchen | Kitchen tickets, availability and stock | Kitchen display, menu availability and ingredient stock |
| Cashier | Table lookup and billing | Tables and billing |

Frontend navigation is permission-filtered only for convenience; every privileged API route is checked on the backend.

## Environment variables

Only backend and build-time variables are used; no `VITE_*` variables are read. See [.env.example](./.env.example) and [server/config.ts](./server/config.ts).

| Variable | Used for | Default / behaviour |
|---|---|---|
| `JWT_SECRET` | Signing JWTs | Unset outside production generates a random per-process secret and logs a warning, so sessions reset on restart; production refuses to start if it is unset or shorter than 32 characters |
| `JWT_EXPIRES_IN` | JWT lifetime | `8h` |
| `DB_PATH` | SQLite file path | `./data/pos.db`, resolved from the project root |
| `PORT` | HTTP port | `3000` for the production server; the dev script sets `3001` |
| `CORS_ORIGIN` | Comma-separated allowlist of cross-origin API clients | `http://localhost:3000,http://127.0.0.1:3000`; `CORS_ORIGINS` remains a fallback. Same-origin requests are always allowed, including static files, which are not subject to CORS |
| `NODE_ENV` | Production cookies, JWT validation, login limit | Defaults to `production` in the compiled server; not listed in `.env.example` |
| `PAYNEST_ROOT` | Override for project-root path resolution | Unset by default; not listed in `.env.example` |
| `API_TARGET` | Vite dev proxy target for `/api` | `http://127.0.0.1:3001`; not listed in `.env.example` |
| `DISABLE_HMR` | Disable Vite HMR and file watching when `true` | Unset by default; not listed in `.env.example` |
| `SEED_DEMO_DATA` | Create the five demo users, floors, tables, menu and sample orders when the `users` table is empty | `false`; set to `true` for a local demo |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` … `CASHIER_EMAIL` / `CASHIER_PASSWORD` | Demo credentials for all five roles; missing passwords are generated and logged once | Placeholders in `.env.example` only |
| `QR_TOKEN_SECRET` | Backend-only HMAC secret for signed table QR tokens | Development fallback; production refuses to start if unset or shorter than 32 characters |
| `QR_TOKEN_TTL_SECONDS` | Lifetime of printed QR tokens in seconds | `31536000` (one year); invalid values fall back to the default. Rotation invalidates sooner |
| `MAX_CASHIER_DISCOUNT_PERCENT` | Maximum discount a cashier may apply to a bill subtotal | `10`; invalid values fall back to `10` |

## Docker

A multi-stage [Dockerfile](./Dockerfile) and [docker-compose.yml](./docker-compose.yml) build the frontend and bundled server, then run the single Node service with production dependencies only:

```bash
docker compose up --build
```

The container listens on port `3000`, stores SQLite at `/data/pos.db` (mount a persistent volume for real data), and exposes `GET /api/health`. Copy `.env.example` to an untracked `.env` first; Compose requires it for secrets and demo settings. `.dockerignore` keeps local `.env`, `node_modules`, and build output out of the image.

## Documentation

- [HowToSetup.md](./HowToSetup.md) — setup, seeding, branding, deployment, and troubleshooting.
- [docs/api.md](./docs/api.md) — every endpoint, its role/permission, request body, and response.
- [LICENSE-NOTE.md](./LICENSE-NOTE.md) — template terms and third-party package notices.
- [CHANGELOG.md](./CHANGELOG.md) — release notes.
