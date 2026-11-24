# PayNest POS API

All routes are mounted by [server/app.ts](../server/app.ts). Requests and responses use JSON. The browser client calls relative `/api` URLs with same-origin credentials (`src/api/client.ts`); there is no separate API host in production.

## Authentication and authorisation

- `GET /api/health` and the `/api/auth/*` router are the only unauthenticated routes. Every other `/api` route passes through `requireAuth`.
- `POST /api/auth/login` verifies the email against an active user with `bcrypt.compare`, signs a JWT, and sets the httpOnly `paynest_token` cookie (`sameSite=lax`, `path=/`, `secure` in production). No token is returned in the body.
- `requireAuth` re-reads the user on each request; tokens for deactivated or deleted users are rejected with `401`, even before expiry.
- Permission checks use `requirePermission` and role checks use `requireRole`; both run on the server. Frontend permission lists are cosmetic only. The single map is [server/permissions.ts](../server/permissions.ts).

Roles (see README for the full permission map):

| Role | Summary |
|---|---|
| `admin` | All 30 permissions, including staff management, settings, and every delete operation |
| `manager` | 19 permissions: dashboards, reports, catalogue and inventory, customers, suppliers, purchases, sales read/create, dues, and invoice settings |
| `cashier` | 6 permissions: `products:read`, `invoice-settings:read`, `customers:read`, `sales:create`, `dues:read`, `dues:write` |

### Status codes and error shape

Errors are returned as `{ "error": "message" }` by [server/middleware.ts](../server/middleware.ts).

| Code | Meaning |
|---|---|
| `200` | Successful read or update |
| `201` | Record created |
| `204` | Record deleted; empty body |
| `400` | Invalid JSON body or Zod validation failure |
| `401` | Missing, invalid, or expired cookie; inactive user |
| `403` | Permission or role denied; CORS origin denied |
| `404` | Record not found |
| `409` | Unique constraint conflict, foreign key still referenced, or last-active-admin guard |
| `429` | Login rate limit (10 attempts per 15 minutes per IP; relaxed under `NODE_ENV=test`) |
| `500` | Unexpected server error |

Dates and times in responses are display strings generated at write time. Financial tables keep snapshots, so historical invoices do not change when a product or customer is edited later.

## Auth — `/api/auth`

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/login` | None (rate limited) | `{ "email": string, "password": string }` | `200` mapped user; sets `paynest_token` cookie |
| `POST` | `/logout` | Any authenticated user | None | `200 { "ok": true }`; clears cookie |
| `GET` | `/me` | Any authenticated user | None | `200` mapped user with role and permission list |

`GET /api/health` (no auth) returns `{ "status": "ok" }`.

## Dashboard and reports

| Method | Path | Required permission | Response |
|---|---|---|---|
| `GET` | `/api/dashboard` | `dashboard:read` | Today's sales/orders/profit, low-stock count, weekly sales, revenue, and net profit |
| `GET` | `/api/reports` | `reports:read` | Dashboard figures plus category revenue shares and total expense |

## Settings

| Method | Path | Required permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/settings` | `settings:read` | None | Mapped single settings row |
| `PUT` | `/api/settings` | `settings:write` | Store name, branch, phone, email, address, currency symbol, VAT percent, tax-inclusive flag, low-stock default, invoice prefix, paper size (`A4`/`80mm`), QR/stamp flags, receipt footer, payment-method map | `200` updated settings |
| `GET` | `/api/invoice-settings` | `invoice-settings:read` (all roles) | None | Same mapped settings row for receipt rendering |

## Users — `/api/users`

Every route additionally requires `requireRole('admin')`, even where the permission map already limits the action to admins.

| Method | Path | Required permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/` | `users:read` | None | `200` array of mapped users (no password hashes) |
| `POST` | `/` | `users:write` | `{ name, email, phone?, role, active?, password }` — `role` is `admin`/`manager`/`cashier`, password at least 8 characters | `201` mapped user |
| `PUT` | `/:id` | `users:write` | Same fields as create; `password` optional | `200` mapped user |
| `POST` | `/:id/toggle` | `users:write` | None | `200` mapped user with flipped `active` |
| `DELETE` | `/:id` | `users:delete` | None | `204` |

Guards: an admin cannot change their own role, deactivate themselves, or delete themselves (`403`). The last active admin cannot be demoted, deactivated, or deleted (`409`). Unknown roles are rejected with `400`. New and changed passwords are bcrypt-hashed with cost 10.

## Products, categories, and inventory

| Method | Path | Required permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/products` | `products:read` | None | `200` mapped products |
| `POST` | `/api/products` | `products:write` | `{ sku, barcode?, name, category, brand?, unit, costPrice, sellPrice, stock, lowStockThreshold, description?, image? }` | `201` mapped product |
| `POST` | `/api/products/import` | `products:write` | `{ products: ProductInput[] }` | `201` mapped products, inserted in one transaction |
| `PUT` | `/api/products/:id` | `products:write` | Product fields; optional `soldToday`, `soldThisWeek` | `200` mapped product |
| `DELETE` | `/api/products/:id` | `products:delete` | None | `204` |
| `GET` | `/api/categories` | `categories:read` | None | `200` mapped categories |
| `POST` | `/api/categories` | `categories:write` | `{ name, description?, color? }` — color `#RRGGBB` | `201` mapped category |
| `PUT` | `/api/categories/:id` | `categories:write` | Same category fields | `200` mapped category |
| `DELETE` | `/api/categories/:id` | `categories:delete` | None | `204` |
| `GET` | `/api/inventory` | `inventory:read` | None | `200 { products, lowStockCount }` |
| `POST` | `/api/inventory/restock` | `inventory:write` | `{ productId, quantity }` — positive integer | `200` mapped product with updated stock |

Missing records return `404`; values that violate unique constraints return `409`.

## Sales and purchases

| Method | Path | Required permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/sales` | `sales:read` | None | `200` mapped sales with line items |
| `POST` | `/api/sales` | `sales:create` | `{ customerId, customerName?, items: [{ productId, quantity }], discount?, vat?, paymentMethod }` — method `Cash`, `bKash`, `Nagad`, `Card`, or `Due` | `201` mapped sale |
| `POST` | `/api/sales/:id/mark-paid` | `dues:write` | None | `200` mapped sale |
| `DELETE` | `/api/sales/:id` | `sales:delete` | None | `204` |
| `GET` | `/api/purchases` | `purchases:read` | None | `200` mapped purchases |
| `POST` | `/api/purchases` | `purchases:write` | `{ supplierName, itemsSummary, itemCount, totalAmount, paidAmount?, status, date }` — status `Received` or `Pending` | `201` mapped purchase |
| `POST` | `/api/purchases/:id/receive` | `purchases:write` | None | `200` mapped purchase |
| `POST` | `/api/purchases/:id/payment` | `purchases:write` | `{ amount }` — positive number, capped at the outstanding balance | `200` mapped purchase |
| `DELETE` | `/api/purchases/:id` | `purchases:delete` | None | `204` |

Sale creation rejects unknown products and insufficient stock with `400`, unknown non-`walk-in` customers with `404`, and runs stock, customer, daily-sales, and line-item writes in one SQLite transaction. The invoice number comes from the fixed `SELECT invoice_number ...` query; no user input is concatenated into SQL.

## Customers, suppliers, and dues

| Method | Path | Required permission | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/customers` | `customers:read` | None | `200` mapped customers |
| `POST` | `/api/customers` | `customers:write` | `{ name, phone?, email, area? }` | `201` mapped customer |
| `PUT` | `/api/customers/:id` | `customers:write` | Customer fields plus optional totals, dues, last-visit, and new-customer flag | `200` mapped customer |
| `DELETE` | `/api/customers/:id` | `customers:delete` | None | `204` |
| `POST` | `/api/customers/:id/collect-due` | `dues:write` | None | `200` mapped customer with cleared dues |
| `GET` | `/api/suppliers` | `suppliers:read` | None | `200` mapped suppliers |
| `POST` | `/api/suppliers` | `suppliers:write` | `{ company, contactName?, phone?, category?, payableAmount?, lastSupply? }` | `201` mapped supplier |
| `PUT` | `/api/suppliers/:id` | `suppliers:write` | Same supplier fields | `200` mapped supplier |
| `DELETE` | `/api/suppliers/:id` | `suppliers:delete` | None | `204` |
| `POST` | `/api/suppliers/:id/settle` | `suppliers:write` | None | `200` mapped supplier with zero payable |
| `GET` | `/api/dues` | `dues:read` | None | `200` mapped due payments |
| `POST` | `/api/dues` | `dues:write` | `{ customerId, amount, method, note? }` — method `Cash`, `bKash`, or `Nagad` | `201` mapped due payment |

Due collection and customer due payment clear the customer balance and mark their due sales paid in one transaction. Unknown customers return `404`.
