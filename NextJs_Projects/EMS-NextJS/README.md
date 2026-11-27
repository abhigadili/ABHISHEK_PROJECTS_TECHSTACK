# EMS-NextJS — Employee Management System (Next.js App Router)

A complete **Next.js** frontend for the existing **EMS-ExpressJS** backend, and a hands-on Next.js learning project: every concept is implemented through a real EMS feature (or a clearly-labelled isolated demo under `/learn`) and documented in [`docs/nextjs-concepts/`](docs/nextjs-concepts/), with a concept → files → tests map in [`EMS-NEXTJS-CONCEPT-MAPPING.md`](docs/nextjs-concepts/EMS-NEXTJS-CONCEPT-MAPPING.md).

* **Frontend only.** No new backend, no new database, no direct MySQL access, **backend not modified**. Express stays the single source of truth for authentication, authorisation, validation and persistence.
* Independent of any other frontend project.

## Technology stack (installed versions)

| Layer | Technology |
|---|---|
| Framework | **Next.js 16.4.5** (App Router, Turbopack, `cacheComponents` = Partial Prerendering + `'use cache'`, `proxy.ts`) |
| UI | **React 19.3.0**, TypeScript 5.9 (`strict`), Tailwind CSS 4 |
| Forms / validation | React Hook Form 7 + **zod 4** (same schemas on client and server) |
| Client state | Redux Toolkit (notification badge, sidebar only) · Context API (auth, theme, toast, config) |
| Charts | Recharts (lazy-loaded island) |
| Unit / component tests | Vitest 3 + Testing Library + jsdom 26 |
| E2E tests | Playwright 1.65 (real browser, real server, **isolated test backend/DB**) |

## Prerequisites

* Node.js ≥ 20.11 (developed on 20.11.1) and npm ≥ 10.
* The **EMS-ExpressJS** backend at `~/Documents/NodeJS_Projects/EMS-ExpressJS` with MySQL running and its `.env` configured.
* Google Chrome for Playwright (`E2E_CHANNEL=chrome`; do not run `playwright install` just to work around Ubuntu browser support).

## Installation

```bash
cd ~/Documents/NextJS_Projects/EMS-NextJS
npm install
cp .env.example .env.local      # then edit the values below
```

## Environment variables

| Variable | Scope | Meaning |
|---|---|---|
| `EMS_API_URL` | **server only** | Express base URL, e.g. `http://localhost:4100/api/v1` |
| `EMS_REVALIDATE_SECRET` | **server only** | ≥ 16 chars, protects `POST /api/revalidate` |
| `EMS_API_TIMEOUT_MS` | server only | per-request timeout (default 10000) |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL` | public | display name and canonical origin (baked in at build time) |

Only `NEXT_PUBLIC_*` values reach the browser; `src/lib/server/**` is `server-only`, so a client import fails the build.

## Backend integration

* Express API: `http://localhost:4100/api/v1` (Swagger: `http://localhost:4100/api-docs`). **The browser never calls it**: Server Components, Server Actions, Route Handlers and `proxy.ts` call it with a Bearer token kept in **HttpOnly cookies** (so the backend's CORS allow-list is irrelevant).
* Endpoint inventory, auth flow, error model, roles, backend quirks the UI works around: [`docs/backend-api-integration.md`](docs/backend-api-integration.md).
* Roles: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`.

### Start the backend (separate terminal)

```bash
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
npm start                       # http://localhost:4100   (or: npm run dev)
# first run only — credentials come from the environment, never from source
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' npm run admin:create
```

### Start the Next.js app

```bash
npm run dev                     # http://localhost:3000
# production:  npm run build && npm start
```

Sign in (username **or** e-mail) or create an account at `/register`.

## Features

| Module | Highlights (all backed by real endpoints) |
|---|---|
| Authentication | login by username/e-mail, self-registration with live username check and picture upload, forgot/reset/change password, logout, silent token refresh, safe `?next=` redirects |
| Dashboard | three **parallel route** slots (KPIs, charts, events) streaming independently; personal summary for employees |
| Employees | URL-driven search/filter/sort/pagination, **intercepting-route modal** with full-page fallback, tabbed details, React-Hook-Form create/edit (field arrays, manager typeahead), job history & promotions, (de)activation, picture upload |
| Departments / designations | CRUD, head picker, activation, cached reference lists with tag invalidation |
| Organization | org chart from the reporting hierarchy: expand/collapse, search + highlight + reveal |
| Attendance | check-in/out, history with range/status filters, team view, calendar, admin correction |
| Leave | balances, apply (with document), history, detail, cancel, manager approvals, HR administration, team calendar |
| Holidays, notifications, reports, users & roles, profile | as named; CSV downloads stream through an allow-listed Route Handler |
| Public | landing (SSG), `/docs/**` (SSG), `/help/**` (ISR + on-demand revalidation), `sitemap.xml`, `robots.txt`, manifest |
| **Learning demos** `/learn` | hooks lab, React patterns lab, React Hook Form lab, navigation functions, all four intercepting conventions — isolated and labelled |

## Rendering, caching and security at a glance

* **SSG** `/`, `/docs/**` · **ISR** `/help/**` · **SSR + streaming** (inside a PPR static shell) for every authenticated screen · **client islands** only where interaction needs them. → [`docs/nextjs-rendering-strategy.md`](docs/nextjs-rendering-strategy.md)
* **User-specific data is never shared-cached.** Only reference data (departments, designations, leave types, holidays) and public help are cached, each with a tag and a tested invalidation. → [`docs/nextjs-caching-strategy.md`](docs/nextjs-caching-strategy.md)
* Authorisation is enforced in pages, Server Actions and Route Handlers (the proxy is only UX); CSRF via SameSite + Origin checks; authenticated pages are `noindex`. → [`docs/nextjs-concepts/44-nextjs-security.md`](docs/nextjs-concepts/44-nextjs-security.md)

## Folder structure

```text
src/
├── app/            routes: (auth) (dashboard) (public) groups · parallel @slots · intercepting (.)[id] · api/ route handlers
├── features/       client islands & feature UI per domain
├── components/     shared UI (common, forms, dialogs, layout)
├── lib/server/     server-only data-access layer (api-client, session, permissions, domain modules)
├── lib/client/     browser helpers      lib/utils/  pure helpers
├── actions/        Server Actions        schemas/    zod (API contract + forms)
├── contexts/ hooks/ store/ constants/ content/ types/
└── proxy.ts        auth redirects + silent token refresh
tests/  e2e/  scripts/e2e-seed.mjs  docs/
```

## Testing

```bash
npm run lint && npm run typecheck
npm test                        # Vitest: 146 tests / 16 files (API client, actions, handlers, proxy, schemas, components, hooks, store, SEO)
```

### End-to-end (Playwright, real backend, isolated data)

E2E must **never** run against the development database. Use the backend's dedicated test database and your **own** Next.js server (Playwright does not start one — a reused dev server could point at the wrong backend):

```bash
# 1. backend: (re)create the isolated test schema, an admin that exists only there, and start it on :4101
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
NODE_ENV=test node -e "require('./tests/globalSetup')()"
NODE_ENV=test ADMIN_EMAIL=e2e.admin@ems.example ADMIN_PASSWORD='<strong password>' node scripts/create-admin.js
NODE_ENV=test PORT=4101 LOGIN_RATE_LIMIT_MAX=1000 API_RATE_LIMIT_MAX=100000 node src/server.js &

# 2. frontend: seed a small org through the API, build, start on :3100 pointing at the TEST backend
cd ~/Documents/NextJS_Projects/EMS-NextJS
export E2E_ADMIN_EMAIL=e2e.admin@ems.example E2E_ADMIN_PASSWORD='<same>' E2E_USER_PASSWORD='<strong password for seeded users>'
EMS_API_URL=http://localhost:4101/api/v1 npm run e2e:seed          # refuses to run against :4100
npm run build
EMS_API_URL=http://localhost:4101/api/v1 NEXT_PUBLIC_APP_URL=http://localhost:3100 npx next start -p 3100 &

# 3. run the suite (48 specs: the 20 required scenarios + registration, uploads, module smoke & flows, learning demos)
E2E_BASE_URL=http://localhost:3100 E2E_CHANNEL=chrome npm run e2e
```

Credentials come from the environment; nothing is committed.

## Learning documentation

* [`docs/nextjs-concepts/`](docs/nextjs-concepts/) — 48 guides (concept, syntax, how Next.js implements it, the actual EMS implementation, files, use case, why, advantages, limitations, mistakes, interview notes) + [`EMS-NEXTJS-CONCEPT-MAPPING.md`](docs/nextjs-concepts/EMS-NEXTJS-CONCEPT-MAPPING.md).
* [`docs/backend-api-integration.md`](docs/backend-api-integration.md), [`docs/nextjs-caching-strategy.md`](docs/nextjs-caching-strategy.md), [`docs/nextjs-rendering-strategy.md`](docs/nextjs-rendering-strategy.md), [`docs/deployment.md`](docs/deployment.md).
* Next.js's own version-matched docs are bundled in `node_modules/next/dist/docs/` — this project follows them (the scaffold's `AGENTS.md` points there).

## Known limitations (documented, not hidden)

* The backend has no endpoints for education/experience/skills (kept in the browser, with a banner), `/users` (derived from employees) or WebSockets (polling is used); `GET /employees` has no date-range filter.
* No Content-Security-Policy header yet; refresh-token single-flight and caches are per instance (see `docs/deployment.md` for scaling notes).
* Under Cache Components a *late* `notFound()` on a dynamic route can answer HTTP 200 with `noindex` on the first hit (see the rendering doc).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| zod validation error at start-up (from `src/lib/server/env.ts`) | missing or malformed server env — copy `.env.example` |
| Pages show "service temporarily unavailable" | backend not running on `EMS_API_URL` (`GET /api/health` shows `upstream`) |
| Immediately signed out after login | backend restarted with different JWT secrets — sign in again |
| Tailwind build error `require() of ES Module …magic-string` | Node < 20.19 with ESM-only magic-string 1.x; `package.json` pins `overrides.magic-string = 0.30.21` (run `npm install`) |
| Upload > 1 MB fails | `experimental.serverActions.bodySizeLimit` (set to 6 MB in `next.config.ts`) |
| Vitest `ERR_REQUIRE_ESM` | jsdom ≥ 27 needs Node ≥ 20.19 — this project pins `jsdom@26` |
| Playwright "chromium not supported" | run with `E2E_CHANNEL=chrome` |
| E2E hits the wrong database | never reuse a running dev server; start your own on :3100 with `EMS_API_URL` → :4101 |
