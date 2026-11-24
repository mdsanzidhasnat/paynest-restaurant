# PayNest Restaurant setup

For the full list of endpoints, permissions, request bodies, and responses, see [docs/api.md](./docs/api.md).

## Requirements

- Node.js 20.19 or newer. The repository pins 20.19.0 in [.nvmrc](./.nvmrc), and `package.json` requires Node `>=20.19.0` and npm `>=10`.
- npm. A clean install from the committed lockfile does not need `legacy-peer-deps`.

## Install and configure

This is a single-package monorepo: the React client, Express API, tests, and docs all live in this repository root. There is no separate web-app folder or workspace package to install.

```bash
npm ci
cp .env.example .env
```

Edit the new `.env` file. [.env.example](./.env.example) contains only backend placeholders:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Secret used to sign auth JWTs; production requires at least 32 characters. Outside production, leaving it unset generates a random per-process secret (sessions reset on restart) |
| `JWT_EXPIRES_IN` | Token lifetime; defaults to `8h` |
| `DB_PATH` | SQLite file location; defaults to `./data/pos.db` |
| `PORT` | HTTP port for the Node server; defaults to `3000` in production and `3001` for `dev:api` |
| `CORS_ORIGIN` | Comma-separated allowlist of cross-origin API clients; same-origin requests and static files are always allowed |
| `SEED_DEMO_DATA` | Set to `true` to create the demo users when the `users` table is empty; defaults to `false` |
| `ADMIN_EMAIL`, `MANAGER_EMAIL`, `WAITER_EMAIL`, `KITCHEN_EMAIL`, `CASHIER_EMAIL` | Demo user email addresses for all five roles |
| `ADMIN_PASSWORD`, `MANAGER_PASSWORD`, `WAITER_PASSWORD`, `KITCHEN_PASSWORD`, `CASHIER_PASSWORD` | Demo user passwords; missing values generate a random password printed once at startup |
| `QR_TOKEN_SECRET` | Backend-only HMAC secret for printed table QR codes; production requires at least 32 characters |
| `QR_TOKEN_TTL_SECONDS` | Printed QR token lifetime in seconds; defaults to one year |
| `MAX_CASHIER_DISCOUNT_PERCENT` | Cashier discount cap in percent; defaults to `10` |

`server/config.ts` also reads `NODE_ENV` and the legacy `CORS_ORIGINS` fallback; `vite.config.ts` reads `API_TARGET` and `DISABLE_HMR`. None of those are required in `.env.example`. No `VITE_*` variables are used: the browser client calls the relative `/api` path with same-origin credentials.

Never commit `.env`. `.gitignore` excludes it.

## Local development

```bash
npm run dev
```

`npm run dev` uses `concurrently` to start:

- `npm run dev:api` — `NODE_ENV=development PORT=3001 tsx watch server/index.ts`.
- `npm run dev:web` — Vite on `http://localhost:3000`, proxying `/api` to `API_TARGET` (`http://127.0.0.1:3001` by default).

Open `http://localhost:3000`. Staff sign in to a role-specific home screen: admin/manager start on the dashboard, waiter on tables, kitchen on the kitchen display and cashier on billing. You can also run the two commands separately. `npm run preview` previews the built `dist/` folder but does not start the API, so the API must still be running for sign-in and data.

Useful checks:

```bash
npm run lint
npm test
npm run smoke
npm run build
```

## Database and seeding

`server/db.ts` creates the parent directory for `DB_PATH`, opens SQLite, applies [docs/schema.sql](./docs/schema.sql), and seeds data only when the `users` table is empty. WAL mode is enabled when the data directory is writable; otherwise startup continues without it. Paths are resolved from the project root (or `PAYNEST_ROOT` if set), not the shell's working directory, so `docs/schema.sql`, `dist/`, and the database are found whether you run `tsx server/index.ts` or `node dist-server/index.js`. The schema is therefore created on first server start.

To reset and reseed everything deliberately:

```bash
npm run seed
```

`npm run seed` calls `initDb(undefined, { reset: true })`, which deletes and recreates all seeded tables. It is destructive; do not run it against data you want to keep. Demo rows are created only when `SEED_DEMO_DATA=true`; without it, the schema is applied but no demo data is inserted.

To generate a portable SQL snapshot of the current seed data (including bcrypt password hashes) for review or importing into an empty database:

```bash
npm run seed:sql
```

This writes [docs/seed.sql](./docs/seed.sql) from the same `src/data/seedData.ts` source used by the runtime seeder. Treat that file as demo-only data and replace its credentials before publication.

## Docker Compose

For a containerised single-service deployment:

```bash
docker compose up --build
```

[Dockerfile](./Dockerfile) builds the client and server with dev dependencies, then copies only the compiled output and production dependencies into the runtime image. [docker-compose.yml](./docker-compose.yml) publishes port `3000`, mounts a named `paynest-data` volume at `/data`, and requires an untracked `.env` file (`cp .env.example .env`). Set `JWT_SECRET` (and any demo variables) there before starting. `GET /api/health` is the container health check. `.dockerignore` prevents `.env`, `node_modules`, and local build output from entering the build context.

## Demo users

When `SEED_DEMO_DATA=true` and the `users` table is empty, [server/seed.ts](./server/seed.ts) creates five active users. Their email addresses and passwords are read from the environment; see README / your `.env` for the password used by your demo.

| Role | Email variable | Password variable |
|---|---|---|
| Admin | `ADMIN_EMAIL` | `ADMIN_PASSWORD` |
| Manager | `MANAGER_EMAIL` | `MANAGER_PASSWORD` |
| Waiter | `WAITER_EMAIL` | `WAITER_PASSWORD` |
| Kitchen | `KITCHEN_EMAIL` | `KITCHEN_PASSWORD` |
| Cashier | `CASHIER_EMAIL` | `CASHIER_PASSWORD` |

If a password variable is missing, a random password is generated and printed once in the startup log (never as a hash). Passwords are stored as bcrypt hashes only. The login route compares the submitted password with the stored hash, signs a JWT, and sets the httpOnly `paynest_token` cookie.

## Run in production

```bash
npm run build
JWT_SECRET=replace-with-a-long-random-secret npm start
```

`npm run build` builds the Vite frontend into `dist/` and bundles the server into `dist-server/index.js` with esbuild. Native modules (`better-sqlite3`, `bcrypt`) stay external and load from `node_modules`. `npm start` is plain `node dist-server/index.js`; TypeScript is no longer executed in production.

The process starts production-first: if `NODE_ENV` is not supplied by the host, the server sets it to `production` itself. It loads `.env` only when that file exists (host environment variables always win), then:

1. Validates `JWT_SECRET`.
2. Resolves `DB_PATH`, opens SQLite, applies the schema, and checks the seed.
3. Mounts the `/api` routers and the public `GET /api/health` check.
4. Serves `dist/` and sends unknown non-API paths to `dist/index.html`.
5. Listens on `0.0.0.0` at `PORT`, which defaults to `3000`.

In production the auth cookie is `secure`, and startup logs a timestamped line for each stage. Startup fails with a stack trace and exit code 1 if `JWT_SECRET` is missing or shorter than 32 characters. Outside production, an unset secret is generated randomly with a warning instead of using a shared fallback. `GET /api/health` returns `{ "status": "ok" }` without authentication.

## Deploying

Deploy this project as a **single Node service** on a platform such as Render, Railway, or a VPS. [render.yaml](./render.yaml) contains a ready-to-use Render definition.

### Render (exact steps)

1. Create a new **Web Service** in Render and connect this repository.
2. Render reads [render.yaml](./render.yaml): region **Singapore**, plan **Free**, `NODE_VERSION=20.19.0`, `NODE_ENV=production`, `JWT_SECRET` generated automatically, `JWT_EXPIRES_IN=1d`, `DB_PATH=./data/pos.db`, and `CORS_ORIGIN` left for you to fill in.
3. Set the build and start commands in the dashboard (or keep the values from `render.yaml`):

   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`

4. `CORS_ORIGIN` is optional for a single Node service because the app and API share an origin. If you set it, use the exact browser origin, for example `https://paynest-pos.onrender.com`. Do not add a trailing slash or a protocol-less host. It is only needed when a separate frontend origin calls `/api`; same-origin requests and static files are never rejected by it.
5. Deploy. Watch the logs for the timestamped startup lines ending in `Listening on PORT ...`; `/api/health` must return `200` before the service is marked healthy.
6. Change the demo passwords or remove the seeded users before exposing the service publicly.

### Free-plan limitations

- The Render free plan **sleeps after inactivity**; the first request after sleep can take several seconds.
- The free plan's filesystem is **not persistent**. SQLite data under `./data/pos.db` resets on redeploy and when the container is replaced. Use a persistent disk (paid plans) or a VPS for real data.
- For a persistent path on a VPS or a Render service with a disk, mount or create the directory first and set `DB_PATH=/var/data/pos.db`. The server creates missing parent directories automatically, but the underlying volume must be writable and persistent. A relative `DB_PATH` is resolved from the project root, not the current shell directory.
- On a VPS: install Node 20.19+, clone the repo, run `npm ci --include=dev && npm run build`, set the environment variables, and run `npm run start` behind a reverse proxy.

A **static-only host cannot run this application**. Uploading only `dist/` to a static CDN, Netlify, cPanel, or a plain Vercel static project will serve the HTML but will not provide `/api/auth/login` or `/api/health`. The existing [vercel.json](./vercel.json) is an SPA rewrite only; it does not run the Express backend. Use a Node-capable host for the full app.

## Replace the demo and seed data

`src/data/seedData.ts` exports the `INITIAL_*` constants used by `server/seed.ts`. To change seeded records:

1. Edit the relevant `RESTAURANT_SETTINGS`, `INITIAL_FLOORS`, `INITIAL_TABLES`, `INITIAL_CATEGORIES`, `INITIAL_INGREDIENTS`, `INITIAL_MENU_ITEMS`, or `INITIAL_COMPLETED_ORDERS` values in [seedData.ts](./src/data/seedData.ts).
2. Edit `DEMO_ACCOUNTS` in [server/seed.ts](./server/seed.ts) if you need different demo identities.
3. Run `npm run seed` to replace the existing rows.

For real use, create records through the UI/API instead of relying on seed data, and replace every demo credential. The runtime API writes to SQLite through the routers in `server/routes/`; `seedData.ts` is only the seed source.

## Change menu images and the logo

Menu-item images and the demo avatar live in [public/images/](./public/images/). Vite copies `public/` into `dist/` unchanged, so replace files there (keeping the same filenames) and they are served at `/images/<filename>` in development and production. The preset image URLs are listed in [productImages.ts](./src/data/productImages.ts) and offered by the menu editor's local image picker; the demo avatar URL is `USER_AVATAR` in [seedData.ts](./src/data/seedData.ts). Update those constants if you rename a file. Existing databases with old `/src/assets/images/...` values are rewritten to `/images/...` automatically at startup by [migrate.ts](./server/migrate.ts). No image or font is fetched from a remote host at runtime.

There is no separate raster logo asset. The mark is an inline SVG in two places:

- [LoginView.tsx](./src/components/views/LoginView.tsx) — login card logo.
- [Sidebar.tsx](./src/components/layout/Sidebar.tsx) — navigation brand logo.

Edit both SVGs to keep the login and sidebar marks consistent. If you replace the mark with a raster image instead, put the file in [public/images/](./public/images/) and reference it as `/images/<filename>`; no component copy or layout changes are needed for the existing inline SVG. The visible product name is also in [index.html](./index.html), [LoginView.tsx](./src/components/views/LoginView.tsx), and [Sidebar.tsx](./src/components/layout/Sidebar.tsx). There is no favicon link or favicon asset in the current project.

## Change Tailwind theme colours

This project does not define a Tailwind `@theme` block. Colours are literal values in two places:

- [src/index.css](./src/index.css) — base page background, text colour, `.pos-card`, scrollbar colours, and print overrides. The `<body>` class in [index.html](./index.html) also contains background, text, and selection colours.
- Tailwind arbitrary-value utility classes such as `bg-[#4F46E5]` and `text-[#111827]` in the layout, common and view components under [src/components/](./src/components/).

To re-theme the app, change the literals in `src/index.css` and `index.html`, then update the utility classes in the relevant components. Keep the existing markup and class structure; only change colour values.

## Change the restaurant name and invoice details

Seeded branding comes from `RESTAURANT_SETTINGS` in [seedData.ts](./src/data/seedData.ts) and is inserted into the single `settings` row by `server/seed.ts`. The live API exposes `GET`/`PUT /api/settings` (admin only) in [settings.ts](./server/routes/settings.ts) and `GET /api/settings/invoice` (all signed-in roles) for receipt branding.

Restaurant name, contact details, address, currency symbol, VAT %, service charge %, invoice prefix, paper size, receipt footer and the default low-stock threshold are stored in the `settings` table. Bill invoices also read these values through `/api/bills/orders/:orderId/invoice` in [billing.ts](./server/routes/billing.ts).

## Guest and staff ordering

Use **Table QR** in the sidebar to generate and print a signed table code. Scanning it opens `/m/:token`, where guests browse available menu items and submit an order without a staff session. New guest orders wait in `pending_confirmation`; a waiter confirms them from the **Waiter order** screen before they reach the kitchen or billing. An admin can enable auto-confirm in **Settings**.

Waiters build orders from menu categories and variants, add notes and send items to the kitchen. Kitchen staff work the New/Preparing/Ready columns with elapsed timers; the optional chime is off by default. Cashiers use **Billing** for server-computed totals, discounts, splits and payment recording. All of these screens call the endpoints documented in [docs/api.md](./docs/api.md); no totals are calculated in the browser.

## Troubleshooting

- **Node or install errors:** use Node 20.19+ (see `.nvmrc`) and reinstall with `npm ci`. No `.npmrc` or `legacy-peer-deps` override is needed.
- **Port 3000 is busy:** stop the other Vite process or choose another port for `npm run dev:web`.
- **Port 3001 is busy in development:** stop the other API process or set `PORT` for `npm run dev:api` and update `API_TARGET`/`CORS_ORIGIN` accordingly. Production defaults to `3000`.
- **Sign-in fails:** confirm the user exists and is active. Demo users are created only with `SEED_DEMO_DATA=true` and the email/password values in `.env`; passwords are compared against stored bcrypt hashes. If a demo password variable was omitted, use the random password printed once in the startup log.
- **Start fails in production:** `JWT_SECRET` must be set and at least 32 characters long. The startup log shows the failed stage and a stack trace. Outside production, an unset secret is generated randomly and only affects session continuity across restarts.
- **Native module crash on startup:** run `npm run smoke`. A failure in `bcrypt` or `better-sqlite3` means the installed binary does not match the Node version/platform; reinstall with `npm ci` on Node 20.19+ (the project pins `better-sqlite3` to 12.11.1).
- **CORS error in the browser:** same-origin requests and static files are always allowed, so check that the browser URL and API URL really are on different origins. For a cross-origin frontend, add its exact origin to `CORS_ORIGIN` and restart the server.
- **Static deployment shows HTML but no API:** static-only hosting cannot run the bundled Node server; deploy the single Node service instead.
- **A guest order is missing from the kitchen:** open **Waiter order** and confirm the `pending_confirmation` ticket, or enable auto-confirm in **Settings**.
- **An action shows a permission message:** the role lacks that backend permission. Ask an admin to review the user role; hiding navigation in the UI is not an access control.
- **Invoice details look generic:** update the `settings` row through `PUT /api/settings` (admin) or change `RESTAURANT_SETTINGS` before reseeding.
