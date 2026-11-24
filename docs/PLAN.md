# Restaurant Management System — Conversion Plan (DRAFT, awaiting approval)

Status: **database layer implemented; API/UI phases pending**. This document is the build
roadmap only and must be deleted before release. Working title: **Restaurant Management System**;
a final product name/brand is a required decision (see §10).

Implementation note (2026-11-24): the restaurant schema, idempotent migrations, server-owned
billing, atomic numbering, five-role demo seed, local SVG placeholders and generated
`docs/seed.sql` are in place. D1–D12 in §10 remain open; the implemented storage choices are
documented in `AGENTS.md` and the README schema summary.

Audit date: 2026-11-24. Repo inspected: `/home/sanzid/paynest-restaurant` (root files, `server/`,
`src/`, `docs/`, `scripts/`, `public/images/`, all config/deploy files and tests).

---

## 1. Scope (exact, and nothing else)

Eight functional areas:

1. **Table management** — floors/areas, table map, server-owned status `free | occupied | bill_pending`.
2. **QR menu and customer ordering** — public, no login, signed table token.
3. **Waiter order screen** — add items with notes, add to an existing order, transfer table.
4. **Kitchen display** — `new → preparing → ready → served`, per-item timers.
5. **Menu management** — categories, items, variants (e.g. half/full), availability toggle.
6. **Billing** — table bill, split bill, discount, VAT and service charge computed on the server,
   printable invoice, payment method recorded as Cash / bKash / Nagad / Card **selection only**.
7. **Ingredient inventory** — ingredients, recipes per menu variant, automatic deduction when an
   order item is served, low-stock alerts.
8. **Reports and roles** — daily sales, top items, table turnover, staff roles. Dashboard/overview
   is folded into area 8 as its landing view; it is not a ninth area.

Explicitly out of scope: payment gateways, SMS/WhatsApp/AI/maps/GPS, multi-branch, delivery-platform
integration, mobile app, barcode scanning, supplier/purchase-order workflow, customer CRM/loyalty,
due collection/credit accounts, reservations, shifts/attendance, tips, inventory lots/expiry.

Audit facts that drive the plan:

- `server/app.ts:57` already puts every non-auth `/api` route behind `requireAuth`; public QR routes
  must be mounted before that line, under `/api/public/...`, with their own rate limits.
- `server/app.ts:29-47` restricts CORS to `/api` only and `server/index.ts:20-29` serves static/SPA
  outside `/api`; preserve that boundary. The SPA fallback currently also catches missing assets —
  it must be changed so `/assets/*` and `/images/*` return a real 404.
- `server/routes/commerce.ts:47-48,117-118` accepts client-supplied `discount` and `vat`; this is the
  main money-trust bug to eliminate. `src/utils/billing.ts` may remain as a **display-only** helper;
  the server needs its own authoritative implementation.
- `src/App.tsx:237-385` has a global barcode scanner; remove it entirely.
- `src/data/seedData.ts`, `docs/seed.sql`, `scripts/generate-seed-sql.ts:23,48-49` and
  `public/images/*` contain grocery products, retail branding, personal names and a hard-coded demo
  password. All must be regenerated from environment-provided demo credentials and relative dates.

---

## 2. Classification of the existing product

### 2.1 Backend endpoints

| Old endpoint(s) | Class | New destination |
|---|---|---|
| `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (`server/routes/auth.ts`, `server/app.ts:51-55`) | KEEP | Same paths; add rate limits + explicit `session:manage` permission on logout/me; cookie `sameSite: 'strict'` |
| `GET /api/dashboard` (`server/routes/admin.ts:18-43`) | ADAPT | `GET /api/reports/overview` (area 8) |
| `GET /api/reports` (`admin.ts:45-60`) | ADAPT | `GET /api/reports/daily-sales`, `/top-items`, `/table-turnover` |
| `GET/PUT /api/settings`, `GET /api/invoice-settings` (`admin.ts:62-124`) | ADAPT | Same paths; restaurant fields, VAT/service-charge basis points, no branch fields |
| `GET/POST /api/users`, `PUT/POST toggle /api/users/:id` (`admin.ts:126-245`) | ADAPT | Same paths; roles enum extended; role ceiling rules; no hard delete |
| `DELETE /api/users/:id` (`admin.ts:247-261`) | REMOVE | Deactivation only; FK `RESTRICT` protects history |
| `GET/POST/PUT/DELETE /api/products`, `POST /api/products/import` (`server/routes/catalog.ts:13-127`) | ADAPT | `/api/menu/items` CRUD + variants + availability; CSV import REMOVED |
| `GET/POST/PUT/DELETE /api/categories` (`catalog.ts:129-175`) | ADAPT | `/api/menu/categories` CRUD with real FK from items |
| `GET /api/inventory`, `POST /api/inventory/restock` (`catalog.ts:177-207`) | ADAPT | `/api/inventory/*` for ingredients, recipes, adjustments, movements; `stock_qty` never directly writable |
| `GET/POST /api/sales`, `POST /api/sales/:id/mark-paid` (`server/routes/commerce.ts:18-228`) | ADAPT | Split into `/api/orders` (state machine) and `/api/bills` (money + payment selection) |
| `DELETE /api/sales/:id` (`commerce.ts:230-237`) | REMOVE | Financial records immutable; void unpaid bills only |
| `GET/POST /api/purchases`, `POST /api/purchases/:id/receive`, `/payment`, `DELETE /api/purchases/:id` (`commerce.ts:252-328`) | REMOVE | No purchasing in v1 (decision D6) |
| `GET/POST/PUT/DELETE /api/customers`, `POST /api/customers/:id/collect-due` (`server/routes/parties.ts:17-109`) | REMOVE (deferred ADAPT to guests/loyalty) | Out of the eight areas (decision D7) |
| `GET/POST/PUT/DELETE /api/suppliers`, `POST /api/suppliers/:id/settle` (`parties.ts:113-173`) | REMOVE | Out of scope |
| `GET/POST /api/dues` (`parties.ts:178-244`) | REMOVE | Out of scope; billing uses recorded payment selection only |

### 2.2 Frontend screens and shared modules

| Existing file/screen | Class | New destination |
|---|---|---|
| `src/components/views/LoginView.tsx` | ADAPT | Login (new branding, new role labels; remove retail illustration/marketing copy) |
| `src/components/views/DashboardView.tsx` | ADAPT (base keep) | Area 8 overview: active tables, live orders, today's sales, low-stock alerts |
| `src/components/views/PosTerminalView.tsx` | ADAPT | Area 3 waiter order screen; remove barcode scanner and client-side billing |
| `src/components/views/ProductsView.tsx`, `AddProductView.tsx` | ADAPT | Area 5 menu item list/editor: categories, variants, availability, image; drop SKU/barcode/brand/unit/cost/CSV |
| `src/components/views/CategoriesView.tsx` | ADAPT | Area 5 menu categories |
| `src/components/views/InventoryView.tsx` | ADAPT | Area 7 ingredients, recipe editor, low-stock, adjustments; no stock-value retail math |
| `src/components/views/SalesHistoryView.tsx` | ADAPT | Bill history (area 6/8) |
| `src/components/views/InvoicePreviewView.tsx`, `src/components/modals/InvoiceModal.tsx` | ADAPT | Printable invoice from `GET /api/bills/:id`; remove WhatsApp/email share, PDF HTML hack, hard-coded QR matrix |
| `src/components/views/ReportsView.tsx` | ADAPT | Area 8 reports; remove `priorWeekRows` and fixed payment splits (`ReportsView.tsx:56-107`) |
| `src/components/views/SettingsView.tsx` | ADAPT | Restaurant settings + staff/roles (admin only) |
| `src/components/views/CustomersView.tsx`, `DueCollectionView.tsx`, `SuppliersView.tsx`, `PurchasesView.tsx` | REMOVE | Out of scope |
| `src/components/common/BarcodeInput.tsx` + test, barcode handler in `src/App.tsx:237-385` | REMOVE | No barcode scanning |
| `src/components/common/CartPanel.tsx`, `ProductTable.tsx`, `ProductThumb.tsx` | ADAPT | Order-lines panel / menu-item table / local image thumb; no client money totals |
| `src/components/charts/*`, `src/components/layout/Sidebar.tsx`, `TopBar.tsx` | ADAPT | New nav, new branding, alerts from low-stock + kitchen timers |
| `src/api/client.ts`, `src/auth/AuthContext.tsx`, `src/types/pos.ts`, `src/utils/*` | ADAPT | New endpoint functions, permissions, domain types, display-only formatters |
| `src/data/seedData.ts`, `src/data/productImages.ts`, `public/images/*` | ADAPT/REMOVE | New menu demo data and local food images; delete grocery photos or replace with locally supplied assets (D9) |
| `src/utils/billing.test.ts`, `dates.test.ts`, `CartPanel.test.tsx`, `BarcodeInput.test.tsx` | ADAPT | Server billing tests become authoritative; keep date tests; delete barcode test |

### 2.3 Backend infrastructure modules

| Module | Class | Change |
|---|---|---|
| `server/index.ts`, `server/app.ts`, `server/paths.ts`, `server/config.ts`, `server/env.ts` | KEEP + ADAPT | Keep single-service static+API serving, production-first defaults, `/api`-only CORS; add public QR router before `requireAuth`, `QR_TOKEN_SECRET`, rate-limit config, real 404 for missing static files |
| `server/db.ts`, `docs/schema.sql` | ADAPT | New schema, `PRAGMA foreign_keys = ON` every connection, WAL, `schema_version` table, no silent `CREATE IF NOT EXISTS` upgrading of an incompatible old DB (D2) |
| `server/auth.ts`, `server/middleware.ts`, `server/errors.ts`, `server/validate.ts`, `server/mappers.ts` | KEEP + ADAPT | Keep DB-authoritative role in `requireAuth`, Zod `parse()`, error mapping; add `strict` cookie, `session:manage`, JSON-only mutation guard for public writes, new mappers |
| `server/permissions.ts` | ADAPT | Five roles, new permission map (§6) |
| `server/seed.ts`, `server/seed-cli.ts`, `server/migrate.ts`, `scripts/generate-seed-sql.ts`, `docs/seed.sql` | ADAPT | New demo data, env-provided passwords, relative dates, no hard-coded demo password; old image-path migration replaced by versioned migration |
| `server/api.test.ts`, `server/migrate.test.ts`, `vitest.config.ts` | ADAPT | Supertest coverage for every new endpoint, role rule and money calculation |
| `Dockerfile`, `docker-compose.yml`, `render.yaml`, `vercel.json`, `.env.example`, `package.json`, `.nvmrc`, `tsconfig.json`, `vite.config.ts` | KEEP + ADAPT | New product name/volume names, new env vars, pin Docker Node to 20.19.0, keep Node ≥20.19.0/npm ≥10; Vercel remains static-only warning |

### 2.4 NEW modules

`server/routes/public.ts` (QR menu/order), `server/routes/tables.ts`, `server/routes/menu.ts`,
`server/routes/orders.ts`, `server/routes/kitchen.ts`, `server/routes/billing.ts`,
`server/routes/inventory.ts`, `server/routes/reports.ts`, `server/qr-token.ts` (HMAC sign/verify/rotate),
`server/billing.ts` (authoritative money), `server/migrations.ts` (versioned DDL),
`src/components/views/TableMapView.tsx`, `QrMenuView.tsx`, `WaiterOrderView.tsx`,
`KitchenDisplayView.tsx`, `BillingView.tsx`, `IngredientInventoryView.tsx` (names are proposals).

---

## 3. New database schema (`docs/schema.sql`)

Conventions: `TEXT` UUID ids with prefixes; **all money as INTEGER minor units (paisa)**; all
percentages as INTEGER basis points (500 = 5.00%); quantities/weights as `REAL ≥ 0`; timestamps as
runtime UTC ISO-8601 strings generated by the server; `PRAGMA foreign_keys = ON` on every connection;
WAL mode; explicit `ON DELETE` on every FK; index on every FK and lookup column; `UNIQUE` on natural
keys; `CHECK` on every status, amount, quantity and role column. No client-writable counters.

| Table | Columns / constraints | FKs and delete rules |
|---|---|---|
| `schema_version` | `version INTEGER PRIMARY KEY`, `applied_at TEXT NOT NULL` | — |
| `users` | `id TEXT PK`, `name`, `email UNIQUE`, `phone`, `role TEXT CHECK IN ('admin','manager','waiter','kitchen','cashier')`, `active INTEGER CHECK (0,1)`, `avatar`, `password_hash`, `last_active`, `created_at` | none; **deactivate, never hard-delete** |
| `settings` | singleton `id INTEGER PK CHECK (id=1)`, `restaurant_name`, `phone`, `email`, `address`, `currency_symbol`, `vat_bps INTEGER CHECK (0..10000)`, `service_charge_bps INTEGER CHECK (0..10000)`, `invoice_prefix`, `paper_size CHECK ('A4','80mm')`, `receipt_footer`, `low_stock_default REAL ≥ 0`, `created_at`, `updated_at` | — |
| `audit_log` | `id INTEGER PK AUTOINCREMENT`, `action`, `entity_type`, `entity_id`, `detail`, `created_at` | `actor_id → users(id) RESTRICT` |
| `floors` | `id TEXT PK`, `name UNIQUE`, `sort_order INTEGER`, `created_at` | — |
| `dining_tables` | `id TEXT PK`, `label`, `seats INTEGER > 0`, `x INTEGER`, `y INTEGER`, `shape CHECK ('round','square')`, `status CHECK ('free','occupied','bill_pending')`, `qr_version INTEGER > 0`, `qr_prev_version INTEGER NULL`, `qr_prev_valid_until TEXT NULL`, `UNIQUE(floor_id,label)` | `floor_id → floors(id) RESTRICT`; status is a **server-only cache** updated by order/bill endpoints, no endpoint writes it directly |
| `menu_categories` | `id TEXT PK`, `name UNIQUE`, `description`, `color`, `sort_order INTEGER`, `active CHECK (0,1)`, `created_at` | — |
| `menu_items` | `id TEXT PK`, `name`, `description`, `image`, `available CHECK (0,1)`, `sort_order INTEGER`, `created_at`, `updated_at`, `UNIQUE(category_id,name)` | `category_id → menu_categories(id) RESTRICT` |
| `menu_variants` | `id TEXT PK`, `name` (e.g. `Regular`, `Half`, `Full`), `price INTEGER > 0`, `available CHECK (0,1)`, `sort_order INTEGER`, `UNIQUE(item_id,name)` | `item_id → menu_items(id) CASCADE` |
| `ingredients` | `id TEXT PK`, `name UNIQUE`, `unit TEXT`, `stock_qty REAL ≥ 0`, `low_stock_threshold REAL ≥ 0`, `unit_cost INTEGER ≥ 0`, `created_at`, `updated_at` | none; `stock_qty` only via `stock_movements` + atomic SQL |
| `recipe_items` | `variant_id`, `ingredient_id`, `quantity REAL > 0`, `PRIMARY KEY(variant_id,ingredient_id)` | `variant_id → menu_variants(id) CASCADE`; `ingredient_id → ingredients(id) RESTRICT` |
| `orders` | `id TEXT PK`, `order_number UNIQUE`, `source CHECK ('qr','waiter')`, `status CHECK ('new','preparing','ready','served','closed')`, `guest_count INTEGER ≥ 0`, `notes`, `request_key TEXT UNIQUE NULL` (QR idempotency), `opened_at`, `closed_at`, `created_at`; `CHECK` that QR orders have no `opened_by` and waiter orders have one | `table_id → dining_tables(id) RESTRICT`, `opened_by → users(id) RESTRICT NULL`, `closed_by → users(id) RESTRICT NULL` |
| `order_items` | `id TEXT PK`, `name_snapshot`, `variant_name_snapshot`, `unit_price INTEGER > 0`, `quantity INTEGER > 0`, `notes`, `status CHECK ('new','preparing','ready','served','cancelled')`, `cancel_reason`, `created_at`, `served_at` | `order_id → orders(id) CASCADE`; `variant_id → menu_variants(id) RESTRICT` |
| `order_item_events` | `id INTEGER PK AUTOINCREMENT`, `from_status NULL`, `to_status CHECK (...)`, `created_at` (timer source) | `order_item_id → order_items(id) CASCADE`; `actor_id → users(id) RESTRICT` |
| `table_transfers` | `id TEXT PK`, `created_at` | `order_id → orders(id) CASCADE`, `from_table_id`/`to_table_id → dining_tables(id) RESTRICT`, `moved_by → users(id) RESTRICT` |
| `stock_movements` | `id INTEGER PK AUTOINCREMENT`, `delta REAL NOT NULL`, `reason CHECK ('served','manual','waste','correction')`, `note`, `actor_id NULL`, `created_at`, `UNIQUE(order_item_id, reason)` guarantees one auto deduction per served line | `ingredient_id → ingredients(id) RESTRICT`, `order_item_id → order_items(id) RESTRICT NULL` |
| `bills` | `id TEXT PK`, `bill_number UNIQUE`, `status CHECK ('open','paid','void')`, `subtotal`, `discount_type CHECK ('none','fixed','percent')`, `discount_value ≥ 0`, `discount_amount ≥ 0`, `taxable ≥ 0`, `vat_amount ≥ 0`, `service_charge_amount ≥ 0`, `total ≥ 0`, `paid_amount ≥ 0 AND ≤ total`, `due_amount ≥ 0`, `payment_method CHECK ('Cash','bKash','Nagad','Card') NULL`, `payment_reference`, `void_reason`, `created_at`, `paid_at`, `voided_at` — **every money column server-computed and stored as a snapshot** | `order_id → orders(id) RESTRICT`, `table_id → dining_tables(id) RESTRICT`, `created_by`/`paid_by`/`voided_by → users(id) RESTRICT` |
| `bill_items` | `id TEXT PK`, `name_snapshot`, `quantity > 0`, `unit_price > 0`, `line_total ≥ 0`, `UNIQUE(bill_id,order_item_id)` prevents double billing | `bill_id → bills(id) CASCADE`; `order_item_id → order_items(id) RESTRICT` |
| `bill_splits` | `id TEXT PK`, `label`, `amount > 0`, `payment_method CHECK (...)`, `payment_reference`, `paid_at`, `created_at`, `UNIQUE(bill_id,label)`; server validates `SUM(amount) ≤ total - paid_amount` | `bill_id → bills(id) CASCADE`; `paid_by → users(id) RESTRICT NULL` |

Indexes to create (in addition to inline UNIQUE constraints): `idx_users_role_active`,
`idx_audit_log_actor_created`, `idx_audit_log_created`, `idx_dining_tables_floor`,
`idx_dining_tables_status`, `idx_floors_sort_order`, `idx_menu_items_category`,
`idx_menu_items_available`, `idx_menu_variants_item`, `idx_recipe_items_ingredient`,
`idx_stock_movements_ingredient`, `idx_stock_movements_order_item`, `idx_stock_movements_created`,
`idx_orders_table_status`, `idx_orders_status_created`, `idx_orders_opened_by`,
`idx_order_items_order`, `idx_order_items_status`, `idx_order_items_variant`,
`idx_order_item_events_item`, `idx_order_item_events_created`, `idx_table_transfers_order`,
`idx_table_transfers_to_table`, `idx_bills_order`, `idx_bills_table`, `idx_bills_status_paid_at`,
`idx_bill_items_bill`, `idx_bill_items_order_item`, `idx_bill_splits_bill`.

Numbering: `orders.order_number` and `bills.bill_number` are generated inside the same transaction
as the insert from a dedicated `number_sequences` row (`SELECT ... FOR UPDATE` equivalent via an
atomic `UPDATE ... RETURNING`), with `UNIQUE` constraints and retry on conflict. Prefix comes from
`settings.invoice_prefix`; never from the client.

Money pipeline (single server function `server/billing.ts`):
`subtotal = Σ(unit_price × qty)` → `discount_amount = clamp(type === 'percent' ? subtotal × value / 10000 : value, 0, subtotal)` →
`taxable = subtotal - discount_amount` → `vat = round(taxable × settings.vat_bps / 10000)` →
`service_charge = round(taxable × settings.service_charge_bps / 10000)` →
`total = taxable + vat + service_charge` → `due = total - paid`. Reject negative, non-integer,
non-finite or oversized values with 400; clamp discount; never accept totals from the client.

---

## 4. API endpoints and required roles

All routes below are under `/api`. Every route uses `requireAuth` **and** `requirePermission` except
the explicitly public block. All list routes support validated `limit` (1–100, default 50) and
`offset` (≥0); all mutations require `Content-Type: application/json` and Zod-validated bodies.

### 4.1 Public (unauthenticated, rate-limited, no staff data)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/health` | public | unchanged |
| POST | `/api/auth/login` | public | 10/15 min per IP; bcrypt; strict cookie |
| GET | `/api/public/menu?token=…` | public, signed table token | 60 req/min/IP; returns categories, item names/descriptions/images, variant names and **menu selling prices only** (D4); no cost, stock, recipes, staff or other-table data |
| POST | `/api/public/orders` | public, signed table token | 10/min/IP and 5/min/token; body `requestKey`, `lines[{variantId,quantity,notes}]`, optional `guestCount`; server resolves prices/availability, creates order `new` for the token's table |
| GET | `/api/public/orders?token=…` | public, signed table token | 60/min/IP; returns only this table's open order status and item statuses; no prices/staff/other tables |

### 4.2 Session, users, settings

| Method | Path | Roles | Permission |
|---|---|---|---|
| POST | `/api/auth/logout` | all authenticated | `session:manage` |
| GET | `/api/auth/me` | all authenticated | `session:manage` |
| GET | `/api/users` | admin, manager | `users:read` |
| POST | `/api/users` | admin (all roles); manager (waiter/kitchen/cashier only) | `users:write` + role-ceiling check |
| PUT | `/api/users/:id` | admin (all roles); manager (waiter/kitchen/cashier only) | `users:write` + ceiling + self/last-admin guards |
| POST | `/api/users/:id/toggle` | admin; manager for lower roles | `users:write` + ceiling + self/last-admin guards |
| GET | `/api/settings` | admin | `settings:read` |
| PUT | `/api/settings` | admin | `settings:write` |
| GET | `/api/invoice-settings` | all authenticated | `invoice-settings:read` |
| GET | `/api/audit-log` | admin | `audit:read` |

No user DELETE endpoint; role values validated against the five-role enum in both Zod and SQLite.

### 4.3 Tables and QR

| Method | Path | Roles | Permission |
|---|---|---|---|
| GET | `/api/floors` | admin, manager, waiter, cashier | `tables:read` |
| POST | `/api/floors` | admin, manager | `tables:write` |
| PUT | `/api/floors/:id` | admin, manager | `tables:write` |
| DELETE | `/api/floors/:id` | admin | `tables:write` (409 if tables exist) |
| GET | `/api/tables` | admin, manager, waiter, cashier | `tables:read` (status computed server-side) |
| GET | `/api/tables/:id` | admin, manager, waiter, cashier | `tables:read` |
| POST | `/api/tables` | admin, manager | `tables:write` |
| PUT | `/api/tables/:id` | admin, manager | `tables:write` (label/seats/x/y/shape/floor **only**, never `status`) |
| DELETE | `/api/tables/:id` | admin | `tables:write` (409 if referenced) |
| POST | `/api/tables/:id/qr` | admin, manager | `tables:qr` (returns printable signed URL) |
| POST | `/api/tables/:id/qr/rotate` | admin, manager | `tables:qr` (bumps `qr_version`, invalidates old token subject to grace D5) |

### 4.4 Menu management

| Method | Path | Roles | Permission |
|---|---|---|---|
| GET | `/api/menu/categories` | all authenticated | `menu:read` |
| POST | `/api/menu/categories` | admin, manager | `menu:write` |
| PUT | `/api/menu/categories/:id` | admin, manager | `menu:write` |
| DELETE | `/api/menu/categories/:id` | admin | `menu:write` (409 if items exist) |
| GET | `/api/menu/items` | all authenticated | `menu:read` |
| GET | `/api/menu/items/:id` | all authenticated | `menu:read` |
| POST | `/api/menu/items` | admin, manager | `menu:write` |
| PUT | `/api/menu/items/:id` | admin, manager | `menu:write` (no counters/prices in body) |
| DELETE | `/api/menu/items/:id` | admin | `menu:write` (409 if order items exist) |
| POST | `/api/menu/items/:id/availability` | admin, manager | `menu:write` |
| POST | `/api/menu/variants` | admin, manager | `menu:write` |
| PUT | `/api/menu/variants/:id` | admin, manager | `menu:write` |
| DELETE | `/api/menu/variants/:id` | admin | `menu:write` (409 if used) |
| POST | `/api/menu/variants/:id/availability` | admin, manager | `menu:write` |

### 4.5 Orders, waiter actions, kitchen

| Method | Path | Roles | Permission |
|---|---|---|---|
| GET | `/api/orders` | all authenticated | `orders:read` (filters `status`,`tableId`,`date`; paginated) |
| GET | `/api/orders/:id` | all authenticated | `orders:read` |
| POST | `/api/orders` | admin, manager, waiter | `orders:write` (staff order; `tableId` from body, status `new`) |
| POST | `/api/orders/:id/items` | admin, manager, waiter | `orders:write` (variantId, quantity, notes; price snapshotted server-side) |
| POST | `/api/orders/:id/items/:itemId/cancel` | admin, manager | `orders:cancel` (only `new`/`preparing`, reason required) |
| POST | `/api/orders/:id/transfer` | admin, manager, waiter | `orders:transfer` (logs `table_transfers`, moves open order) |
| POST | `/api/orders/:id/close` | admin, manager | `orders:close` (abandoned orders; normal close is automatic on bill payment) |
| GET | `/api/kitchen/tickets` | admin, manager, kitchen | `kitchen:read` (statuses `new`,`preparing`,`ready`; includes elapsed times) |
| POST | `/api/kitchen/items/:id/start` | admin, manager, kitchen | `kitchen:transition` (`new → preparing`) |
| POST | `/api/kitchen/items/:id/ready` | admin, manager, kitchen | `kitchen:transition` (`preparing → ready`) |
| POST | `/api/kitchen/items/:id/serve` | admin, manager, waiter, kitchen | `orders:serve` (`ready → served`; **deducts recipe stock in one transaction**) |

### 4.6 Billing

| Method | Path | Roles | Permission |
|---|---|---|---|
| GET | `/api/bills` | admin, manager, cashier, waiter | `bills:read` (paginated) |
| GET | `/api/bills/:id` | admin, manager, cashier, waiter | `bills:read` (also the printable-invoice payload) |
| POST | `/api/bills` | admin, manager, cashier | `bills:write` (body: `orderId`, `discountType`, `discountValue`; all money server-computed; sets table `bill_pending`) |
| POST | `/api/bills/:id/split` | admin, manager, cashier | `bills:split` (equal N parts or custom amounts; server allocates remainder) |
| POST | `/api/bills/:id/pay` | admin, manager, cashier | `bills:pay` (body: payment method selection, optional split id, reference; no amounts accepted; frees table and closes order) |
| POST | `/api/bills/:id/void` | admin, manager | `bills:void` (unpaid bills only, reason required) |

### 4.7 Ingredient inventory

| Method | Path | Roles | Permission |
|---|---|---|---|
| GET | `/api/inventory/ingredients` | admin, manager, kitchen | `inventory:read` |
| GET | `/api/inventory/ingredients/:id` | admin, manager, kitchen | `inventory:read` |
| POST | `/api/inventory/ingredients` | admin, manager | `inventory:write` |
| PUT | `/api/inventory/ingredients/:id` | admin, manager | `inventory:write` (metadata only; `stock_qty` not accepted) |
| DELETE | `/api/inventory/ingredients/:id` | admin | `inventory:write` (409 if referenced) |
| POST | `/api/inventory/adjustments` | admin, manager | `inventory:write` (delta + reason; atomic with movement row) |
| GET | `/api/inventory/movements` | admin, manager, kitchen | `inventory:read` (paginated) |
| GET | `/api/inventory/low-stock` | admin, manager, kitchen | `inventory:read` (threshold comparison on the server) |
| GET | `/api/menu/variants/:id/recipe` | admin, manager, kitchen | `recipe:read` |
| PUT | `/api/menu/variants/:id/recipe` | admin, manager | `recipe:write` (transactional replace of ingredient lines) |

### 4.8 Reports

| Method | Path | Roles | Permission |
|---|---|---|---|
| GET | `/api/reports/overview` | admin, manager | `reports:read` |
| GET | `/api/reports/daily-sales` | admin, manager | `reports:read` (validated `from`/`to`, runtime dates) |
| GET | `/api/reports/top-items` | admin, manager | `reports:read` |
| GET | `/api/reports/table-turnover` | admin, manager | `reports:read` |
| GET | `/api/reports/staff` | admin, manager | `reports:read` + `users:read` |

Reports derive from `bills`, `bill_items`, `orders` and `order_item_events` with SQL `GROUP BY`;
no client-writable aggregate tables.

---

## 5. Permission map (`server/permissions.ts`)

`admin` has every permission. `✓` = granted; blank = denied. Frontend receives this list from
`/api/auth/me` and only hides controls.

| Permission | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|
| `session:manage` | ✓ | ✓ | ✓ | ✓ |
| `invoice-settings:read` | ✓ | ✓ | ✓ | ✓ |
| `tables:read` | ✓ | ✓ |  | ✓ |
| `tables:write`, `tables:qr` | ✓ |  |  |  |
| `menu:read` | ✓ | ✓ | ✓ | ✓ |
| `menu:write` | ✓ |  |  |  |
| `inventory:read` | ✓ |  | ✓ |  |
| `inventory:write`, `recipe:write` | ✓ |  |  |  |
| `recipe:read` | ✓ |  | ✓ |  |
| `orders:read` | ✓ | ✓ | ✓ | ✓ |
| `orders:write`, `orders:transfer` | ✓ | ✓ |  |  |
| `orders:cancel`, `orders:close` | ✓ |  |  |  |
| `orders:serve` | ✓ | ✓ | ✓ |  |
| `kitchen:read`, `kitchen:transition` | ✓ |  | ✓ |  |
| `bills:read` | ✓ | ✓ |  | ✓ |
| `bills:write`, `bills:split`, `bills:pay` | ✓ |  |  | ✓ |
| `bills:void` | ✓ |  |  |  |
| `reports:read` | ✓ |  |  |  |
| `users:read`, `users:write` | ✓ (lower roles only) |  |  |  |
| `audit:read` |  |  |  |  |
| `settings:read`, `settings:write` |  |  |  |  |

Role rules enforced on the backend: role values validated via `z.enum(ROLES)` and SQLite `CHECK`;
a user cannot change **their own** role/active state; the last active admin cannot be demoted or
deactivated; managers cannot create, edit or deactivate `admin`/`manager` users; `requireAuth`
re-reads the role from the DB on every request (ignore JWT role); deactivation takes effect on the
next request. Check + write for the last-admin and role-ceiling rules must run in one transaction.

---

## 6. Screens per role

Navigation stays state-driven in `src/App.tsx` (`NavSection` + `allowedSections` + `Sidebar.tsx`);
no React Router. Public QR menu is a separate unauthenticated view at `/menu?token=…`.

| Screen (new/proposed file) | admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|
| Login (`LoginView.tsx`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| QR menu + cart (public view) | ✓¹ | ✓¹ | ✓¹ | ✓¹ | ✓¹ |
| Overview / reports (`ReportsView.tsx` landing) | ✓ | ✓ |  |  |  |
| Table map + floor/table admin (`TableMapView.tsx`) | ✓ full | ✓ full | ✓ view |  | ✓ view |
| Waiter order (`WaiterOrderView.tsx`) | ✓ | ✓ | ✓ |  |  |
| Kitchen display (`KitchenDisplayView.tsx`) | ✓ | ✓ |  | ✓ |  |
| Menu management (`ProductsView`/`CategoriesView` adapted) | ✓ | ✓ |  |  |  |
| Billing + bill history + invoice print (`BillingView.tsx`) | ✓ | ✓ | read-only |  | ✓ |
| Ingredient inventory + low-stock (`IngredientInventoryView.tsx`) | ✓ | ✓ |  | read-only panel |  |
| Reports (daily sales, top items, turnover, staff) | ✓ | ✓ |  |  |  |
| Settings + staff roles (`SettingsView.tsx`) | ✓ | staff read only |  |  |  |

¹ Staff can open the public menu for testing; it never uses their session or staff endpoints.
Frontend hiding is cosmetic only; the backend permission map is authoritative.

---

## 7. QR token design

- Secret: backend-only `QR_TOKEN_SECRET` (≥32 chars in production, separate from `JWT_SECRET`,
  never `VITE_*`). Development may generate a per-process random secret with a warning.
- Format: `base64url(JSON payload).base64url(HMAC_SHA256(secret, payload))`, prefix `v1`.
  Payload: `{ "v": 1, "t": "<table UUID>", "ver": <dining_tables.qr_version>, "exp": <unix seconds> }`.
  Printed codes are long-lived (default 365 days; configurable via `QR_TOKEN_TTL_SECONDS`).
- Verification: constant-time signature comparison, then payload shape/version, `exp`, table exists,
  `ver === dining_tables.qr_version` (or `ver === qr_prev_version && now < qr_prev_valid_until`
  during an optional grace window). Table ids are UUIDs; the signature prevents enumeration even if
  ids leak. Tokens are not bearer credentials for staff APIs and carry no role/privilege.
- Rotation: `POST /api/tables/:id/qr/rotate` increments `qr_version`, optionally records the old
  version in `qr_prev_version` with a short `qr_prev_valid_until` (default 0 = immediate
  invalidation, decision D5), writes `audit_log`, and returns the new printable URL. Global secret
  rotation requires regenerating all printed QR codes; document it as an operational procedure.
- Public-request hardening: rate limit per IP **and** per token; require `application/json` on POST;
  Zod-validate token/lines/quantities/notes (max lengths); cap lines per order and total quantity;
  resolve all prices/availability on the server; idempotency via `request_key`; responses include
  only public menu data and the requester's own table order status.

## 8. Order status state machine

Order (`orders.status`) and item (`order_items.status`) are separate but linked:

```
(order)   new ──▶ preparing ──▶ ready ──▶ served ──▶ closed
(items)   new ──▶ preparing ──▶ ready ──▶ served
                     └────────▶ cancelled        (new only, or preparing with manager approval)
```

- Creating an order (public or waiter) creates all lines with status `new` and sets table `occupied`.
- `start` (kitchen) sets item `new → preparing`; all `new` items of an order flip the order to `preparing`.
- `ready` (kitchen) sets item `preparing → ready`; all served/ready items flip the order to `ready`.
- `serve` (waiter/kitchen/manager/admin) sets item `ready → served`, stamps `served_at`, writes an
  event, **atomically deducts recipe quantities from ingredients and inserts one `stock_movements`
  row per ingredient**, then flips the order to `served` when every non-cancelled item is served.
  Insufficient stock → 409 and no state change (D8).
- Bill creation (cashier/manager/admin) requires every non-cancelled item served (D3), snapshots
  lines into `bill_items`, computes all money, sets table `bill_pending`.
- Payment sets bill `paid`, table `free`, order `closed`. Voiding an unpaid bill reopens the table.
- No backward transitions. Cancellation is a status, never a delete; cancelled items are excluded
  from billing and stock deduction. Every transition writes `order_item_events` for timers/audit.

---

## 9. Build phases (each ends with `npm run build`, `npm run lint`, `npm test`, then a clear commit)

0. **Approval** of this plan and the decisions in §10. Delete `docs/PLAN.md` only at release.
1. **Foundation/rebrand**: package/metadata/deploy names, env vars, five roles, new `docs/schema.sql`
   + `schema_version` migration, fresh DB policy, settings defaults, new seed generator, remove
   `pos/` duplicate from build context (D1). Tests: schema constraints, migration, seed.
2. **Auth & infrastructure**: strict cookie, `session:manage`, users/roles/settings/audit endpoints,
   CORS/static/404/rate-limit plumbing, public router scaffold. Tests: all role rules, CORS, 404.
3. **Menu, tables, QR**: menu CRUD/variants/availability, floors/tables, HMAC token service, public
   menu/order endpoints, idempotency and rate limits. Tests: every endpoint, token tampering/expiry/
   rotation, public data minimisation.
4. **Orders & kitchen**: waiter order endpoints, transfers, state machine, events/timers, kitchen
   display, cancellation. Tests: legal/illegal transitions, permissions, transfer audit.
5. **Billing**: server billing function, bill creation, splits, payment selection, void, printable
   invoice, table/order closure. Tests: VAT/service/discount math, tampering rejection, split sums,
   double-bill prevention, table state transitions.
6. **Inventory**: ingredients, recipes, atomic served deduction, adjustments, low-stock alerts.
   Tests: deduction idempotency, insufficient stock, movement audit, recipe validation.
7. **Reports & frontend**: all new screens, permission-driven nav, charts from real data, rebranded
   seed data and local images, docs (`README.md`, `HowToSetup.md`, `docs/api.md`, `CHANGELOG.md`,
   `LICENSE-NOTE.md`, `AGENTS.md`), delete obsolete grocery assets. Tests: component + API integration.
8. **Hardening/release**: Docker/Render verification, `/api/health`, CSP `img-src 'self' data:` check,
   numeric/concurrency stress tests, remove this plan, final full check suite.

---

## 10. Risks and decisions needed from you

1. **D1 — Duplicate checkout**: `/home/sanzid/paynest-restaurant/pos/` is a byte-identical copy with
   its own `.git`, `node_modules`, `.env`, build output and two SQLite DBs. It is untracked by the
   parent repo and `.dockerignore` patterns do not match inside it, so secrets can leak into image
   builds. Recommend deleting/moving it outside the project and adding `pos/**` to `.dockerignore`.
   Confirm? Also: the parent git worktree is `/home/sanzid` and this directory is untracked —
   should I initialise a repo here or commit from the parent?
2. **D2 — Data migration**: no compatible path from the old retail DB. Recommend a fresh DB with a
   versioned migration table and no import of old data. Confirm?
3. **D3 — Billing gate**: require all non-cancelled items `served` before a bill can be created (my
   recommendation), or allow billing open orders? This affects table turnover and stock timing.
4. **D4 — Public menu prices**: expose menu selling prices to QR guests (recommended) or hide all
   prices and show only names?
5. **D5 — QR rotation grace**: immediate invalidation (recommended) or a short grace window (e.g.
   24 h) for already-printed codes?
6. **D6 — Ingredient purchasing**: confirm suppliers/purchase orders are removed in v1 and ingredient
   stock changes only via manual adjustments + automatic deduction.
7. **D7 — Guests/loyalty**: confirm customers/loyalty/due collection are out of scope (they are not
   among the eight areas), even though the old customer module could be adapted later.
8. **D8 — Stock shortfall**: when a served item's recipe ingredient is insufficient, recommend
   blocking the `serve` transition with 409 until adjusted; alternatively allow negative stock and
   alert. Confirm.
9. **D9 — Assets/branding**: approve a new product name and provide or approve locally generated food
   images. All existing images are grocery photos and several old files carry personal names.
   The old retail copy and PayNest branding will not be carried over.
10. **D10 — Split bill semantics**: amount-based splits (equal/custom amounts, recommended) or
    item-level splits where guests are assigned specific lines?
11. **D11 — Service charge/VAT defaults**: confirm initial `vat_bps` and `service_charge_bps`
    (recommend 0/0 in settings, configured per deployment), and currency symbol (currently `৳`).
12. **D12 — Money API representation**: integer minor units (paisa) in all API bodies/responses
    (recommended, avoids float drift) or decimal strings parsed server-side?

I will not start implementation until you approve this plan and answer (or explicitly defer) the
decisions above.
