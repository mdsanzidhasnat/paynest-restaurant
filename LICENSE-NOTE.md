# License and asset notes

## Template terms — complete before marketplace publication

No project-level `LICENSE` file is present. The draft notice below keeps placeholders for the year, your name, and the licence type. It is not legal advice or a substitute for the marketplace's required licence text; replace every bracketed value and confirm the final terms before distributing:

> Copyright © [Year] [Your Name]. Licensed under [Licence Type]. The purchaser receives a non-exclusive, non-transferable licence to use and modify this template in [number] end product(s). The template source may not be resold, sublicensed, or redistributed as a standalone template. Third-party packages and assets remain subject to their own licences. The template is provided “as is,” without warranties to the extent permitted by law.

If these terms do not match the licence you own or intend to grant, replace them with the marketplace-approved licence and provide any required `LICENSE` file. A source header in [src/App.tsx](./src/App.tsx) currently declares `SPDX-License-Identifier: Apache-2.0`; reconcile that header with the final choice before publication.

## Direct package dependencies

The table lists every direct entry in the `dependencies` and `devDependencies` sections of [package.json](./package.json). License identifiers were read from the installed package metadata; check the corresponding package licence files and current terms when publishing.

| Package | Manifest section | License |
|---|---|---|
| `bcrypt` | dependencies | MIT |
| `better-sqlite3` | dependencies | MIT |
| `cookie-parser` | dependencies | MIT |
| `cors` | dependencies | MIT |
| `dotenv` | dependencies | BSD-2-Clause |
| `express` | dependencies | MIT |
| `express-rate-limit` | dependencies | MIT |
| `helmet` | dependencies | MIT |
| `jsonwebtoken` | dependencies | MIT |
| `lucide-react` | dependencies | ISC |
| `react` | dependencies | MIT |
| `react-dom` | dependencies | MIT |
| `qrcode.react` | dependencies | ISC |
| `zod` | dependencies | MIT |
| `@tailwindcss/vite` | devDependencies | MIT |
| `@testing-library/jest-dom` | devDependencies | MIT |
| `@testing-library/react` | devDependencies | MIT |
| `@testing-library/user-event` | devDependencies | MIT |
| `@types/bcrypt` | devDependencies | MIT |
| `@types/better-sqlite3` | devDependencies | MIT |
| `@types/cookie-parser` | devDependencies | MIT |
| `@types/cors` | devDependencies | MIT |
| `@types/express` | devDependencies | MIT |
| `@types/jsonwebtoken` | devDependencies | MIT |
| `@types/node` | devDependencies | MIT |
| `@types/react` | devDependencies | MIT |
| `@types/react-dom` | devDependencies | MIT |
| `@types/supertest` | devDependencies | MIT |
| `@vitejs/plugin-react` | devDependencies | MIT |
| `concurrently` | devDependencies | MIT |
| `esbuild` | devDependencies | MIT |
| `jsdom` | devDependencies | MIT |
| `supertest` | devDependencies | MIT |
| `tailwindcss` | devDependencies | MIT |
| `tsx` | devDependencies | MIT |
| `typescript` | devDependencies | Apache-2.0 |
| `vite` | devDependencies | MIT |
| `vitest` | devDependencies | MIT |

These are direct dependencies only; their transitive dependencies may have additional notices. Retain the package notices required by each licence. `dotenv` is loaded only by the backend entry points. `esbuild` is a direct devDependency used only to bundle the server at build time; native runtime packages (`bcrypt`, `better-sqlite3`) stay in `dependencies`.

## Fonts and images

The interface does not load fonts remotely. [src/index.css](./src/index.css) prefers **Inter** when it is installed locally and otherwise falls back to the platform UI font stack; no font file is bundled or fetched at runtime. If you bundle Inter later, include its SIL Open Font License (OFL) 1.1 notice.

The menu-item and avatar demo images under [public/images/](./public/images/) are AI-generated for demonstration only. Replace them with assets you have rights to use if their origin or licence cannot be confirmed for commercial distribution.
