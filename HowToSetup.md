# PayNest Restaurant setup

This guide covers two complete install targets: a plain Node.js host and Docker Compose. For endpoint details, see [docs/api.md](./docs/api.md).

## Prerequisites

- Node.js `>=20.19.0` and npm `>=10`. The repository pins `20.19.0` in [.nvmrc](./.nvmrc) and declares the same range in [package.json](./package.json).
- A writable directory for SQLite. The default is `./data/pos.db`, resolved from the project root unless `PAYNEST_ROOT` is set.
- On Linux, install `python3`, `make` and `g++` if prebuilt binaries for `bcrypt` or `better-sqlite3` are unavailable. On macOS, install Xcode Command Line Tools. On Windows, use WSL2 with the Linux toolchain for the smoothest native-module install.
- Ports `3000` (staff app / production API) and `3001` (development API) available.

## A. Install with Node.js

1. Copy the environment template and edit it:

   ```bash
   cp .env.example .env
   ```

   Set `JWT_SECRET` and `QR_TOKEN_SECRET` to different random strings of at least 32 characters. Set every demo password you plan to use, or leave a value blank to have a random password printed once at startup. Keep `SEED_DEMO_DATA=true` only for a local demo. Never commit `.env` and never prefix a secret with `VITE_`.

2. Install exact locked dependencies:

   ```bash
   npm ci
   ```

3. Build the frontend and bundle the server:

   ```bash
   npm run build
   ```

4. Seed a fresh demo database:

   ```bash
   npm run seed
   ```

   This is destructive: it deletes and recreates seeded tables. It inserts demo rows only when `SEED_DEMO_DATA=true` and the `users` table is empty. `npm run seed:sql` regenerates [docs/seed.sql](./docs/seed.sql) instead of changing the live database.

5. Start the single Node service:

   ```bash
   npm run start
   ```

   The compiled server serves both `/api` and `dist/`. Production-first defaults apply when the host does not set `NODE_ENV`; `PORT` defaults to `3000`.

6. Check health:

   ```bash
   curl http://localhost:3000/api/health
   ```

   Expected response: `{"status":"ok"}`.

7. Open `http://localhost:3000` and sign in with a demo email and its password from `.env`. Admin and manager land on the dashboard, waiter on tables, kitchen on the kitchen display and cashier on billing.

For development with hot reload, run `npm run dev`; Vite serves port `3000` and proxies `/api` to the API on port `3001`.

## B. Install with Docker

1. Copy the environment template (optional if your host supplies the same variables):

   ```bash
   cp .env.example .env
   ```

   Set `JWT_SECRET`, `QR_TOKEN_SECRET` and the demo passwords before starting. The Compose file declares `.env` as optional, so host environment variables can be used instead.

2. Build and start in the background:

   ```bash
   docker compose up --build -d
   ```

3. The container publishes `3000:3000`. SQLite lives at `/data/pos.db` inside the container and is persisted by the named volume `paynest-data`. Removing the container does not remove that volume; `docker compose down -v` does.

4. Check health and logs:

   ```bash
   curl http://localhost:3000/api/health
   docker compose ps
   docker compose logs -f app
   ```

   The Dockerfile also defines the same `/api/health` check for the container runtime.

5. Open `http://localhost:3000` and sign in with a demo email and its configured password.

The image is multi-stage, pins Node `20.19.0`, installs native build tools only in the build stage, prunes dev dependencies, runs as a non-root user and includes a `HEALTHCHECK`.

## Demo users

When `SEED_DEMO_DATA=true` and the `users` table is empty, [server/seed.ts](./server/seed.ts) creates five active users. Emails and passwords are read from the environment; a missing password is generated and printed once in plaintext during seeding, then stored only as a bcrypt hash.

| Role | Email variable | Password variable |
|---|---|---|
| Admin | `ADMIN_EMAIL` | `ADMIN_PASSWORD` |
| Manager | `MANAGER_EMAIL` | `MANAGER_PASSWORD` |
| Waiter | `WAITER_EMAIL` | `WAITER_PASSWORD` |
| Kitchen | `KITCHEN_EMAIL` | `KITCHEN_PASSWORD` |
| Cashier | `CASHIER_EMAIL` | `CASHIER_PASSWORD` |

Change or remove demo credentials before exposing the service.

## Change branding and theme

- **Restaurant name:** the browser title and social metadata are in [index.html](./index.html); the login card copy is in [src/components/views/LoginView.tsx](./src/components/views/LoginView.tsx); the staff sidebar name comes from the settings API and the seeded value in [src/data/seedData.ts](./src/data/seedData.ts). Admin can change the live value in **Settings**.
- **Logo:** the mark is an inline SVG in [src/components/views/LoginView.tsx](./src/components/views/LoginView.tsx) and [src/components/layout/Sidebar.tsx](./src/components/layout/Sidebar.tsx). Edit both SVGs to keep them consistent. There is no separate raster logo file.
- **Theme colours:** there is no Tailwind `@theme` block. Literal tokens live in [src/index.css](./src/index.css) (`#F6F8FB` page background, `#111827` text, scrollbar `#D1D5DB`/`#9CA3AF`) and as utility classes under [src/components/](./src/components/) (primary `#4F46E5`, hover `#4338CA`, border `#E6EAF0`, surface white). Change both places to re-theme.

## Menu images

All image paths live in [public/images/](./public/images/) and are referenced as `/images/<filename>`. Vite copies that folder into `dist/` unchanged. The preset list is [src/data/productImages.ts](./src/data/productImages.ts) and the menu editor offers those local files; no image is fetched from a remote host. Replace files with your own licensed assets while keeping the same filenames, or update the preset list and seed data together.

## Replace seed data

`src/data/seedData.ts` exports the `RESTAURANT_SETTINGS`, `INITIAL_FLOORS`, `INITIAL_TABLES`, `INITIAL_CATEGORIES`, `INITIAL_INGREDIENTS`, `INITIAL_MENU_ITEMS` and `INITIAL_COMPLETED_ORDERS` constants used by [server/seed.ts](./server/seed.ts). Demo identities are in `DEMO_ACCOUNTS` in that server file. After editing, run `npm run seed` against a disposable database. For real use, create records through the staff screens or API rather than relying on seed data.

## Print table QR codes

1. Sign in as admin or manager.
2. Open **Table QR** from the sidebar, choose a table and print the generated local QR code.
3. The code opens `/m/:token` on a guest device. `QR_TOKEN_SECRET` signs it and `QR_TOKEN_TTL_SECONDS` controls its lifetime.
4. Use **Rotate** to invalidate previously printed codes for that table. Guest orders arrive in `pending_confirmation`; a waiter confirms them in **Waiter order**, or an admin enables auto-confirm in **Settings**.

## Tests and checks

```bash
npm run lint
npm test
npm run build
npm run smoke
npm audit
```

`npm run lint` type-checks, `npm test` runs Vitest with Supertest, `npm run build` builds both targets, and `npm run smoke` verifies the native bcrypt/better-sqlite3 modules. `npm run dev` uses `cross-env` for its inline environment variables, and `npm run clean` removes `dist/` and `dist-server/` with a Node script instead of shell-specific `rm`. CI runs lint, build, tests and `npm audit --omit=dev --audit-level=high`; results are recorded in [docs/security-audit.md](./docs/security-audit.md).

## Supported operating systems

- **Linux:** fully supported; install the native build toolchain listed above when prebuilt modules are unavailable.
- **macOS:** supported with Xcode Command Line Tools.
- **Windows:** use WSL2 with Ubuntu for Node installs. Docker Desktop or a Compose v2-compatible engine also works.
- **Docker:** requires Docker Engine with Compose v2 or a compatible Compose provider.

## Deployment

### Render

[render.yaml](./render.yaml) defines a single Node web service named `paynest-restaurant`:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm run start`
- Health check: `/api/health`
- Node `20.19.0`, production environment and generated `JWT_SECRET`/`QR_TOKEN_SECRET`.

Set `CORS_ORIGIN` only if a separate frontend origin calls the API; same-origin requests always work. The free plan sleeps after inactivity and its filesystem is ephemeral, so SQLite under `./data/pos.db` resets on redeploy. Use a persistent disk and set `DB_PATH` to a path on that disk for real data.

### VPS or other Node host

Install Node 20.19+, clone the repository, copy `.env.example` to `.env`, set the secrets, then run `npm ci --include=dev && npm run build && npm run start` behind a reverse proxy. Mount a persistent directory and point `DB_PATH` at it. Verify `/api/health` before routing traffic.

A static-only host cannot run this application: uploading only `dist/` gives you HTML with no `/api/auth/login`, no API and no SQLite. Use a Node-capable host for the full service.
