# License and asset notes

## Template terms — complete before marketplace publication

No project-level `LICENSE` file is present. The draft notice below keeps placeholders for the year, your name, and the licence type. It is not legal advice or a substitute for the marketplace's required licence text; replace every bracketed value and confirm the final terms before distributing:

> Copyright © [Year] [Your Name]. Licensed under [Licence Type]. The purchaser receives a non-exclusive, non-transferable licence to use and modify this template in [number] end product(s). The template source may not be resold, sublicensed, or redistributed as a standalone template. Third-party packages and assets remain subject to their own licences. The template is provided “as is,” without warranties to the extent permitted by law.

If these terms do not match the licence you own or intend to grant, replace them with the marketplace-approved licence and provide any required `LICENSE` file. A source header in [src/App.tsx](./src/App.tsx) currently declares `SPDX-License-Identifier: Apache-2.0`; reconcile that header with the final choice before publication.

## Direct package dependencies

The table lists every direct entry in the `dependencies` and `devDependencies` sections of [package.json](./package.json), in the same order and with the same exact versions. License identifiers were read from the installed package metadata; check the corresponding package licence files and current terms when publishing.

| Package | Manifest section | Version | License |
|---|---|---|---|
| `bcrypt` | dependencies | 6.0.0 | MIT |
| `better-sqlite3` | dependencies | 12.11.1 | MIT |
| `cookie-parser` | dependencies | 1.4.7 | MIT |
| `cors` | dependencies | 2.8.6 | MIT |
| `dotenv` | dependencies | 17.4.2 | BSD-2-Clause |
| `express` | dependencies | 4.22.3 | MIT |
| `express-rate-limit` | dependencies | 8.7.5 | MIT |
| `helmet` | dependencies | 8.3.0 | MIT |
| `jsonwebtoken` | dependencies | 9.0.3 | MIT |
| `lucide-react` | dependencies | 0.546.0 | ISC |
| `qrcode.react` | dependencies | 4.2.0 | ISC |
| `react` | dependencies | 19.3.1 | MIT |
| `react-dom` | dependencies | 19.3.1 | MIT |
| `zod` | dependencies | 4.6.7 | MIT |
| `@tailwindcss/vite` | devDependencies | 4.3.5 | MIT |
| `@testing-library/jest-dom` | devDependencies | 6.9.1 | MIT |
| `@testing-library/react` | devDependencies | 16.3.3 | MIT |
| `@testing-library/user-event` | devDependencies | 14.6.13 | MIT |
| `@types/bcrypt` | devDependencies | 6.0.0 | MIT |
| `@types/better-sqlite3` | devDependencies | 9.6.0 | MIT |
| `@types/cookie-parser` | devDependencies | 1.4.10 | MIT |
| `@types/cors` | devDependencies | 2.8.19 | MIT |
| `@types/express` | devDependencies | 4.17.25 | MIT |
| `@types/jsonwebtoken` | devDependencies | 9.0.10 | MIT |
| `@types/node` | devDependencies | 22.20.5 | MIT |
| `@types/react` | devDependencies | 19.3.0 | MIT |
| `@types/react-dom` | devDependencies | 19.3.0 | MIT |
| `@types/supertest` | devDependencies | 7.2.1 | MIT |
| `@vitejs/plugin-react` | devDependencies | 6.3.0 | MIT |
| `concurrently` | devDependencies | 9.2.5 | MIT |
| `esbuild` | devDependencies | 0.28.2 | MIT |
| `jsdom` | devDependencies | 28.0.0 | MIT |
| `supertest` | devDependencies | 7.3.2 | MIT |
| `tailwindcss` | devDependencies | 4.3.5 | MIT |
| `tsx` | devDependencies | 4.23.15 | MIT |
| `typescript` | devDependencies | 7.0.2 | Apache-2.0 |
| `vite` | devDependencies | 8.3.8 | MIT |
| `vitest` | devDependencies | 4.1.12 | MIT |

These are direct dependencies only; their transitive dependencies may have additional notices. Retain the package notices required by each licence. `dotenv` is loaded only by the backend entry points. `esbuild` is a direct devDependency used only to bundle the server at build time; native runtime packages (`bcrypt`, `better-sqlite3`) stay in `dependencies`.

## Fonts and images

The interface does not load fonts remotely. [src/index.css](./src/index.css) prefers **Inter** when it is installed locally and otherwise falls back to the platform UI font stack; no font file is bundled or fetched at runtime. If you bundle Inter later, include its SIL Open Font License (OFL) 1.1 notice.

All demo images under [public/images/](./public/images/) are original placeholders created for this restaurant demo. Replace them with assets you have rights to use for your restaurant. No third-party stock or generated image service is used at runtime.
