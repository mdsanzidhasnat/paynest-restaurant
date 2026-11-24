# Restaurant Management API

All routes are mounted by [server/app.ts](../server/app.ts). Requests and responses use JSON. The browser client calls relative `/api` URLs with same-origin credentials (`src/api/client.ts`); there is no separate API host in production.

The React staff screens in [src/components/views/](../src/components/views/) use this API through the typed client in [src/api/client.ts](../src/api/client.ts). A `401` clears the local session and a `403` shows a friendly permission banner; roles land on their primary screen (admin/manager dashboard, waiter tables, kitchen display, cashier billing). Screens format server-owned money with [src/utils/money.ts](../src/utils/money.ts) and never send totals or counters.

Every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) must send `Content-Type: application/json` or it is rejected with `415`. List endpoints accept `limit` (default `1000`, maximum `5000`) and `offset` (default `0`); invalid values return `400`.

## Authentication and authorisation

- `GET /api/health`, the `/api/auth/*` router and the signed-token `/api/public/*` router are the only unauthenticated routes. Every other `/api` route passes through `requireAuth`.
- `POST /api/auth/login` verifies the email against an active user with `bcrypt.compare`, signs a JWT, and sets the httpOnly `paynest_token` cookie (`sameSite=strict`, `path=/`, `secure` in production). No token is returned in the body.
- `requireAuth` re-reads the user on each request; tokens for deactivated or deleted users are rejected with `401`, even before expiry.
- Permission checks use `requirePermission` and role checks use `requireRole`; both run on the server. Frontend permission lists are cosmetic only. The single map is [server/permissions.ts](../server/permissions.ts).

| Role | Summary |
|---|---|
| `admin` | Every permission: tables, menu, orders, kitchen, bills, inventory, reports, users, settings |
| `manager` | Everything except user management and settings; can cancel orders, override item status, apply discounts and void bills |
| `waiter` | Reads menu/tables/orders/bills; creates and modifies orders, transfers tables, serves items, requests bills; no discounts, reports or deletes |
| `kitchen` | Reads menu, inventory, recipes, orders and kitchen tickets; moves items `new → preparing → ready` (and availability toggle); cannot serve or take payment |
| `cashier` | Reads orders and bills; applies discounts capped by `MAX_CASHIER_DISCOUNT_PERCENT` (default `10`), splits bills, records payments and reads invoices; no reports or menu price edits |

### Status codes and error shape

Errors are returned as `{ "error": "message", ...details }` by [server/middleware.ts](../server/middleware.ts).

| Code | Meaning |
|---|---|
| `200` | Successful read or update |
| `201` | Record created |
| `204` | Record deleted; empty body |
| `400` | Invalid JSON body, Zod validation failure or bad query parameter |
| `401` | Missing, invalid, or expired cookie; inactive user |
| `403` | Permission or role denied; CORS origin denied |
| `404` | Record not found |
| `409` | Invalid state transition, insufficient stock (`lowStock: true`, `ingredientId`), unpaid bill close, unique constraint conflict, foreign key still referenced, or last-active-admin guard |
| `415` | Mutating request without `Content-Type: application/json` |
| `429` | Rate limit: login (10 attempts per 15 minutes per IP; relaxed under `NODE_ENV=test`) or public routes (see below) |
| `500` | Unexpected server error |

Money fields are INTEGER minor units (paisa). Percentages are REAL values in `0..100`. All totals, VAT, service charge, discounts, due amounts and counters are computed by [server/billing.ts](../server/billing.ts) and [server/order-totals.ts](../server/order-totals.ts); clients never send them.

## Auth — `/api/auth`

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/login` | None (rate limited) | `{ "email": string, "password": string }` | `200` mapped user with permissions; sets `paynest_token` cookie |
| `POST` | `/logout` | Any authenticated user | None (JSON content type not required) | `200 { "ok": true }`; clears cookie |
| `GET` | `/me` | Any authenticated user | None | `200` mapped user with role and permission list |

`GET /api/health` (no auth) returns `{ "status": "ok" }`.

## Tables — `/api/tables`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/floors` | `tables:read` | — | `200` floors ordered by `sort_order` |
| `POST` | `/floors` | `tables:write` | `{ name, sortOrder? }` | `201` floor |
| `GET` | `/map` | `tables:read` | — | `200` floors each with their tables |
| `GET` | `/` | `tables:read` | `?status=free\|occupied\|bill_pending` | `200` tables with `floorName` |
| `GET` | `/:id` | `tables:read` | — | `200` table |
| `POST` | `/` | `tables:write` | `{ floorId, number, seats?, x?, y?, shape? }` | `201` table |
| `PUT` | `/:id` | `tables:write` | Any of the create fields | `200` table |
| `GET` | `/:id/qr` | `tables:read` | — | `200 { tableId, tableNumber, version, token, path, url }` |
| `POST` | `/:id/qr/rotate` | `tables:qr` | `{}` | `200` new token with incremented `version` |

`status` and `qr_secret_version` are server-owned; no endpoint accepts them as input. Table status is derived from open orders and bills. `path`/`url` point to `/m/:token`, the guest page. The QR token is an HMAC-SHA256-signed `{ t: tableId, v: version, exp: unixSeconds }` payload; rotating the table version invalidates every previously issued code. See the public routes below.

## Public QR ordering — `/api/public`

These routes are the only unauthenticated API routes besides login and health. They accept a signed table token from the scanned QR code and never expose cost, stock, recipe, staff, other-table or internal table data. Same-origin browser requests are always allowed by the CORS middleware.

| Method | Path | Auth | Body / query | Response |
|---|---|---|---|---|
| `GET` | `/menu` | None (signed token, rate limited) | `?token=` | `200 { restaurantName, table: { label }, categories: [{ id, name, description, items: [{ id, name, description, image, price, variants }] }] }` |
| `POST` | `/orders` | None (signed token, rate limited) | `{ token, items: [{ menuItemId, variantId?, quantity, note? }] }` | `201 { orderId, status, tableLabel }` |
| `GET` | `/orders/:id` | None (signed token, rate limited) | `?token=` | `200 { orderId, status, tableLabel, items: [{ id, name, status }] }`, or `404` if the order belongs to another table |

Validation and safety rules:

- Only available categories, items and variants are returned; images are local `/images/...` paths. No stock counts, costs, recipes, staff fields or internal table IDs appear in public responses.
- `quantity` is `1..20`; `note` is at most 140 characters; an order has `1..20` lines and at most 50 total items. Prices and totals sent by a client are ignored: Zod strips unknown fields and the server resolves every unit price from `menu_items`/`item_variants`.
- Guest orders have `source = 'qr'`, `status = 'pending_confirmation'` and no `opened_by`. They do not occupy the table as active orders, appear on kitchen tickets, enter reports, become billable, or allow item changes until a waiter confirms them. `POST /api/orders/:id/confirm` moves them to `new`.
- An admin can enable `autoConfirmPublicOrders` in settings; such orders enter `new` directly. This is a staff-only setting and is never sent by a public request.
- Limits: 60 menu/status reads per minute per IP, 10 orders per minute per IP and 5 orders per minute per table token. Exceeding them returns `429`. Mutating requests still require `Content-Type: application/json` (`415` otherwise).
- Tokens are HMAC-SHA256 over a base64url payload containing the table id, current `qr_secret_version` and an expiry (`QR_TOKEN_TTL_SECONDS`, default one year). Verification uses a constant-time comparison and checks the current table version; tampered, expired and rotated tokens return `401`.

## Menu — `/api/menu`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/categories` | `menu:read` | — | `200` categories |
| `POST` | `/categories` | `menu:write` | `{ name, description?, color?, sortOrder?, active? }` | `201` category |
| `PUT` | `/categories/:id` | `menu:write` | Any category field | `200` category |
| `DELETE` | `/categories/:id` | `menu:write` | — | `204` |
| `GET` | `/variants` | `menu:read` | — | `200` variants |
| `POST` | `/variants` | `menu:write` + `menu:price` | `{ menuItemId, name, price, available?, sortOrder? }` | `201` variant |
| `PUT` | `/variants/:id` | `menu:write` (+ `menu:price` when `price` present) | Any variant field | `200` variant |
| `DELETE` | `/variants/:id` | `menu:write` | — | `204` |
| `GET` | `/` | `menu:read` | `?categoryId=` | `200` items with `variants` |
| `GET` | `/:id` | `menu:read` | — | `200` item with `variants` |
| `POST` | `/` | `menu:write` + `menu:price` | `{ categoryId, name, description?, image?, price, prepStation?, sortOrder?, available? }` | `201` item |
| `PUT` | `/:id` | `menu:write` (+ `menu:price` when `price` present) | Any item field | `200` item |
| `PATCH` | `/:id/availability` | `menu:availability` | `{ available: boolean }` | `200` item |
| `DELETE` | `/:id` | `menu:write` | — | `204` |

`menu:price` is granted only to admin and manager. `menu:availability` is granted to admin, manager and kitchen. Deleting a category or item referenced by historical orders returns `409`.

## Orders — `/api/orders`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/` | `orders:read` | `?status=&tableId=` | `200` orders |
| `GET` | `/:id` | `orders:read` | — | `200` order with `items`, `payments`, `splits` |
| `POST` | `/` | `orders:write` | `{ tableId, guestCount?, notes? }` | `201` order; `order_number` allocated atomically |
| `POST` | `/:id/confirm` | `orders:write` | `{}` | `200` guest order moved from `pending_confirmation` to `new` |
| `POST` | `/:id/items` | `orders:write` | `{ menuItemId, variantId?, quantity, notes? }` | `201` order with server price snapshots |
| `PATCH` | `/items/:itemId/notes` | `orders:write` | `{ notes }` | `200` order |
| `DELETE` | `/items/:itemId` | `orders:write` | — | `200` order; only `new` items can be removed |
| `POST` | `/:id/transfer` | `orders:transfer` | `{ toTableId }` | `201 { transfer, order }` |
| `POST` | `/:id/cancel` | `orders:cancel` | `{ reason }` | `200` cancelled order (`payment_status: void`) |
| `POST` | `/:id/items/:itemId/cancel` | `orders:cancel` | `{ reason }` | `200` order |
| `POST` | `/:id/items/:itemId/serve` | `orders:serve` | `{}` | `200 { item, lowStock, orderStatus, order }` |

Adding an item snapshots the menu name, variant name and unit price into `order_items`; later menu edits never change an existing order. Every item mutation recomputes stored totals from those snapshots. Starting an order on an occupied table, or transferring to a non-free table, returns `409`. Cancelling requires a non-empty reason and is limited to admin/manager. Guest orders in `pending_confirmation` reject item changes, status transitions and billing with `409` until `POST /:id/confirm` accepts them.

### Item state machine

Orders created by a waiter start at `new`; public QR orders start at `pending_confirmation` until confirmed. `new → preparing → ready → served`. Invalid forward moves (for example `new → ready`) return `409`. `ready → served` is performed by `POST /api/orders/:id/items/:itemId/serve` and deducts recipe ingredients in the same IMMEDIATE transaction. Backward moves require `orders:override` (admin/manager) and return `403` for kitchen staff. Serving with insufficient stock returns `409` with `{ lowStock: true, ingredientId }` and rolls back the whole transition.

## Kitchen — `/api/kitchen`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/tickets` | `kitchen:read` | — | `200` active items with table, floor, order number and `age_minutes` |
| `GET` | `/orders/:id` | `kitchen:read` | — | `200` order with items and status events |
| `PATCH` | `/items/:id/status` | `kitchen:transition` | `{ status: 'new'\|'preparing'\|'ready' }` | `200 { item, lowStock, orderStatus }` |

Backward transitions require `orders:override`. The kitchen cannot mark items served; that belongs to the waiter/order flow above. Tickets exclude `pending_confirmation` orders and every transition on them is rejected with `409`. Every transition writes an `order_item_events` row for timers and audit.

## Billing — `/api/bills`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/orders/:orderId` | `bills:read` | — | `200 { order, lines, totals, paid, due, payments, splits, settings }` |
| `POST` | `/orders/:orderId/request` | `bills:request` | `{}` | `201` bill; allocates `bill_number` once, sets table to `bill_pending` |
| `POST` | `/orders/:orderId/discount` | `bills:write` | `{ type: 'none'\|'fixed'\|'percent', value }` | `200` bill with resolved discount |
| `POST` | `/orders/:orderId/splits` | `bills:split` | `{ mode: 'equal', parts }` or `{ mode: 'items' }` | `201` bill with split plan summing exactly to `total` |
| `POST` | `/orders/:orderId/payments` | `bills:pay` | `{ method, amount, reference?, splitId? }` | `201` bill; closes when payments cover total |
| `POST` | `/orders/:orderId/close` | `bills:pay` | `{}` | `200` closed bill, or `409` if still underpaid |
| `POST` | `/orders/:orderId/void` | `bills:void` | `{}` | `200` void bill and freed table |
| `GET` | `/orders/:orderId/invoice` | `bills:read` | — | `200 { invoiceNumber, issuedAt, ...bill }` |

`method` is one of `Cash`, `bKash`, `Nagad`, `Card` and is a recorded selection only — no gateway or messaging integration. Guest orders still in `pending_confirmation` cannot be billed (`409`). Discounts are resolved on the server, clamped to `0..subtotal`, and further capped for cashiers by `MAX_CASHIER_DISCOUNT_PERCENT`. `equal` splits use integer minor units with the remainder on the last split; `items` splits distribute proportionally to line totals with the rounding drift on the last split. `closeIfPaid` sets `payment_status: paid`, `status: closed` and frees the table via the shared table-status recomputation.

## Inventory — `/api/inventory`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/ingredients` | `inventory:read` | — | `200` ingredients with `low_stock` flag |
| `GET` | `/ingredients/:id` | `inventory:read` | — | `200` ingredient |
| `POST` | `/ingredients` | `inventory:write` | `{ name, unit?, stock?, lowStockThreshold?, unitCost? }` | `201` ingredient |
| `PUT` | `/ingredients/:id` | `inventory:write` | Any ingredient field | `200` ingredient |
| `DELETE` | `/ingredients/:id` | `inventory:write` | — | `204` |
| `POST` | `/ingredients/:id/adjust` | `inventory:write` | `{ quantity, note? }` (positive or negative delta) | `201` ingredient; writes a `manual` stock movement |
| `GET` | `/low-stock` | `inventory:read` | — | `200` ingredients where `stock <= low_stock_threshold` |
| `GET` | `/movements` | `inventory:read` | — | `200` stock ledger, newest first |
| `GET` | `/recipes/:menuItemId` | `recipe:read` | — | `200` recipe lines with ingredient details |
| `PUT` | `/recipes/:menuItemId` | `recipe:write` | `{ lines: [{ ingredientId, quantity }] }` | `200` saved recipe lines |

Recipes are per menu item, not per variant. Stock below zero is rejected with `409`. Deleting an ingredient used by a recipe returns `409`.

## Reports — `/api/reports`

Every report requires `reports:read` (admin and manager) and uses indexed queries with `ORDER BY ... LIMIT ? OFFSET ?`. Unconfirmed guest orders are excluded from open-order counts and item rankings.

| Method | Path | Response |
|---|---|---|
| `GET` | `/dashboard` | Today's sales/orders, weekly revenue, open orders, occupied tables, low-stock count |
| `GET` | `/daily-sales` | Daily snapshots, newest first |
| `GET` | `/top-items` | Items ranked by served quantity and revenue |
| `GET` | `/table-turnover` | Completed orders and revenue per table |
| `GET` | `/low-stock` | `{ count, items }` using `COUNT(*)` |
| `GET` | `/` | Dashboard figures plus the top ten items |

## Users — `/api/users`

Every route additionally requires `requireRole('admin')`.

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/` | `users:read` | — | `200` mapped users (no password hashes) |
| `GET` | `/:id` | `users:read` | — | `200` mapped user |
| `POST` | `/` | `users:write` | `{ name, email, phone?, role, active?, password }` — role must be one of the five; password at least 8 characters | `201` mapped user |
| `PUT` | `/:id` | `users:write` | Same fields as create; `password` optional | `200` mapped user |
| `POST` | `/:id/toggle` | `users:write` | `{}` | `200` mapped user with flipped `active` |
| `DELETE` | `/:id` | `users:delete` | — | `204` |

Guards: an admin cannot change their own role, deactivate themselves, or delete themselves (`403`). The last active admin cannot be demoted, deactivated, or deleted (`409`). Unknown roles are rejected with `400`. New and changed passwords are bcrypt-hashed with cost 10.

## Settings — `/api/settings`

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/` | `settings:read` | — | `200` single settings row plus `autoConfirmPublicOrders` boolean |
| `PUT` | `/` | `settings:write` | `{ restaurantName, phone?, email?, address?, currencySymbol, vatPercent, serviceChargePercent, invoicePrefix, paperSize, receiptFooter?, lowStockDefault, autoConfirmPublicOrders? }` | `200` updated settings |
| `GET` | `/invoice` | `invoice-settings:read` (all roles) | — | `200` branded subset for receipt rendering |

VAT and service-charge percentages come from this singleton row and are applied by the server when computing bills; no client request may override them. `autoConfirmPublicOrders` is optional on `PUT` (omitting it leaves the flag unchanged) and is admin-only, like all settings writes. When enabled, public QR orders skip waiter confirmation and enter the kitchen queue as `new`.
