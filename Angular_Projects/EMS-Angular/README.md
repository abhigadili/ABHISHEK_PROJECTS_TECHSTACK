# EMS-Angular — Employee Management System (Angular frontend)

A complete Angular 19 front-end for the existing **EMS-ExpressJS** backend (Express 5 + MySQL). The backend stays the single source of truth for authentication, authorisation, validation, business rules and data; this project contains **no** backend logic and **no** mock data.

It doubles as a practical Angular learning project: every concept in the brief is implemented against a real screen and documented in [`docs/angular-concepts/`](docs/angular-concepts) (24 guides + a [concept → file → test mapping](docs/angular-concepts/EMS-ANGULAR-CONCEPT-MAPPING.md)). How the app talks to the API — endpoints, auth, roles, gaps, backend findings — is in [`docs/backend-api-integration.md`](docs/backend-api-integration.md).

| | |
|---|---|
| Frontend location | `~/Documents/Angular_Projects/EMS-Angular` |
| Backend location | `~/Documents/NodeJS_Projects/EMS-ExpressJS` (unchanged) |
| Angular / TypeScript | 19.2.x / 5.7 (Angular 20+ needs Node ≥ 20.19; this machine has Node 20.11.1) |
| Dev URL / API URL | `http://localhost:4200` / `http://localhost:4100/api/v1` |

## Technology stack
| Layer | Technology |
|---|---|
| UI framework | Angular 19 — standalone components, new control flow, signals |
| Language | TypeScript (strict, strict templates) |
| UI components | Angular Material 19 (M3 theme) + SCSS, design tokens in `src/styles.scss` |
| Reactive | RxJS 7.8 + Angular Signals (no NgRx) |
| Forms | Reactive Forms (typed, `FormArray`, async validators) + one Template-driven form |
| HTTP | `HttpClient` with functional interceptors (auth, refresh, errors, loading, correlation id) |
| Charts | Chart.js 4 + ng2-charts 8 |
| Unit tests | Jasmine + Karma (ChromeHeadless) — 194 tests |
| E2E | Playwright — 24 tests against the real backend |
| Quality | angular-eslint (flat config), Prettier, bundle budgets |

## Features / modules (all lazy-loaded, all backed by real API endpoints)
Authentication (**self-registration**, login by username or email, logout, silent token refresh, forgot/reset/change password, role-based navigation, 403/404 pages) · Dashboard (cards, charts, role-aware widgets, pending approvals, birthdays/anniversaries) · Employees (list with URL-driven search/filter/sort/paging, details with tabs, create/edit with `FormArray` education/experience/skills, profile + picture upload, activate/deactivate, job history, promotion/transfer, CSV export) · Departments · Designations (job level/grade) · Organization chart (live hierarchy, expand/collapse, search, manager sub-tree, reporting chain, direct reports) · Attendance (check-in/out, history, summary, corrections, monthly/department reports) · Leave (types, apply, balances, history, details, documents, cancel, approvals, HR administration) · Calendar & Holidays (attendance, leave and holiday views, weekly offs) · Notifications (list, read/unread, mark all, polled badge) · Reports (7 backend reports + audit log, filters, search, pagination, **CSV export**) · Users & Roles · Profile & Settings.

**Known gaps (the backend has no API — nothing is faked; see §7 of the backend doc):** education/experience/skills are kept in the browser only (clearly labelled), no `/users` collection (the Users screen is built on the employee accounts), polling instead of push notifications, UI preferences are browser-local.

## Prerequisites
* Node.js ≥ 20.11 (tested 20.11.1) and npm ≥ 10
* The EMS-ExpressJS backend with MySQL running (see *Backend startup*)
* Google Chrome (unit tests and, optionally, E2E)

## Installation
```bash
cd ~/Documents/Angular_Projects/EMS-Angular
npm install
```

## Backend startup (separate from the frontend)
```bash
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
npm start            # or: npm run dev        → http://localhost:4100  (Swagger: /api-docs, health: /health)
```
MySQL must be reachable with the credentials in the backend's own `.env`. The first SUPER_ADMIN is created with the backend's `npm run admin:create` (see its README). Nothing in the Angular project reads or stores those credentials.

## Angular startup (separate from the backend)
```bash
cd ~/Documents/Angular_Projects/EMS-Angular
npm start            # = ng serve (development config + dev proxy)  → http://localhost:4200
```
### Angular CLI commands
| Command | Purpose |
|---|---|
| `npm start` / `ng serve` | dev server with live reload and the `/api` proxy |
| `npm run build` / `ng build` | production build → `dist/ems-angular` |
| `ng build --configuration development` | unoptimised build |
| `npm test` | unit tests once, headless Chrome (`CHROME_BIN=/usr/bin/google-chrome npm test` if Chrome isn't auto-detected) |
| `npm run test:watch` · `npm run test:coverage` | watch mode · coverage report in `coverage/` |
| `npm run lint` · `npm run format` | ESLint · Prettier |
| `npm run e2e` | Playwright (see *E2E tests*) |

## Environment configuration and API base URL
* `src/environments/environment.ts` (production) and `environment.development.ts` (replaced in `ng serve`/dev builds via `angular.json` `fileReplacements`) hold `apiBaseUrl`, `apiTimeoutMs`, `notificationPollMs`. They are exposed through DI tokens `API_BASE_URL` and `APP_CONFIG` (`src/app/core/tokens/tokens.ts`). No secrets live in these files.
* `apiBaseUrl` is the **relative** `/api/v1`.
  * **Development:** `proxy.conf.json` forwards `/api` to `http://localhost:4100`, so the browser sees a same-origin request and the backend's CORS list (`http://localhost:3000` only) is irrelevant. To point at another backend edit the `target` there.
  * **Production, same origin (recommended):** serve `dist/ems-angular/browser` and reverse-proxy `/api` to Express, e.g. nginx:
    ```nginx
    location /api/ { proxy_pass http://127.0.0.1:4100; }
    location /     { root /srv/ems/browser; try_files $uri /index.html; }
    ```
  * **Production, cross-origin:** set `apiBaseUrl` to the absolute URL in `environment.ts` **and** add the frontend origin to the backend's `CORS_ALLOWED_ORIGINS`. (The app then automatically stops sending the custom `X-Request-Id` header, which the backend CORS list would reject.)

## Authentication mechanism (what the backend actually does)
JWT access token (15 min, `Authorization: Bearer`) + rotating refresh token, both returned in the JSON body. The app keeps the access token **in memory** and the refresh token in **`sessionStorage`**; on a 401 it performs **one** shared refresh and replays the failed requests; a failed refresh signs the user out; page reload restores the session through the refresh token before any guard runs. Changing a password revokes all sessions, so the app signs the user out. Details and trade-offs: [backend doc §2](docs/backend-api-integration.md) and [guide 17](docs/angular-concepts/17-httpclient-and-interceptors.md). Roles: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE` — UI checks are conveniences, the backend enforces everything.

## Project structure
```
src/app/
├── core/                    # singletons: no UI
│   ├── errors/              # AppError normalisation, global ErrorHandler
│   ├── guards/              # auth, guest, role, permission, child, unsaved-changes
│   ├── interceptors/        # correlation id, loading, error, auth, refresh (+ HttpContext flags)
│   ├── models/              # typed API contracts (no `any`)
│   ├── resolvers/           # employee & department resolvers
│   ├── services/            # api, auth, employee, department, designation, attendance, leave, organization,
│   │                        # notification, dashboard, report, profile, holiday, picture, reference-data, …
│   └── tokens/              # API_BASE_URL, APP_CONFIG, storage tokens
├── shared/                  # reusable, feature-agnostic
│   ├── components/          # data-table, pagination, search-box, dialogs, employee-select (CVA), calendar, …
│   ├── directives/ pipes/ validators/ utils/
├── layout/                  # app shell: sidenav, toolbar, breadcrumbs, user & notification menus
└── features/                # auth, dashboard, employees, departments, designations, organization, attendance,
                             # leaves, holidays, notifications, reports, users, profile, errors
e2e/                         # Playwright specs, helpers and the idempotent seed script
docs/                        # backend-api-integration.md · angular-concepts/ (24 guides + mapping)
```

## Unit tests
```bash
npm test                     # 194 tests, ~2 s of execution after the build
```
Covers components (login, dashboard, employee list/form, department form, attendance, leave apply, organization chart, notifications), services (auth, employee, department, attendance, leave, organization, dashboard, notification, reference data, picture, token storage), and the Angular concepts (pipes, directives, validators, FormArray/FormBuilder, ControlValueAccessor, signals state, RxJS transformations, route guards, interceptors, lifecycle hooks). See [guide 23](docs/angular-concepts/23-angular-testing.md).

## E2E tests (Playwright, real backend, isolated data)
E2E must **never** touch real data, so it targets the backend's own **test database**:

```bash
# 1. fresh test schema + first admin (backend's own tooling; refuses any DB not ending in _test)
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
NODE_ENV=test node -e "require('./tests/globalSetup')()"
NODE_ENV=test ADMIN_EMAIL=e2e.admin@ems.test ADMIN_PASSWORD='<a strong password>' node scripts/create-admin.js
# 2. test API on :4101
NODE_ENV=test PORT=4101 node src/server.js &

# 3. seed realistic data through the public API and run the suite
cd ~/Documents/Angular_Projects/EMS-Angular
export E2E_ADMIN_EMAIL=e2e.admin@ems.test E2E_ADMIN_PASSWORD='<same password>'
npm run e2e:seed             # departments, designations, manager/HR/employees, a holiday, a pending leave
npx playwright install chromium   # once, if your OS is supported; otherwise use installed Chrome:
export E2E_CHANNEL=chrome
npm run e2e                  # starts `ng serve --configuration e2e` (proxy → :4101) automatically
```
Seeded users (`e2e/seed.mjs`): `hannah.manager@ems.test` (MANAGER), `harry.hr@ems.test` (HR_ADMIN), `eve.employee@ems.test`, `evan.employee@ems.test`, `sally.sales@ems.test` (EMPLOYEE); password = `E2E_USER_PASSWORD` (default is a throw-away test value in the script). The suite is re-runnable (per-run dates for leave/holiday; the password-change test restores the password). To start clean, repeat step 1.

## Production build
```bash
npm run build                # → dist/ems-angular  (initial ≈ 1.0 MB raw / ≈ 260 kB transferred, ~80 lazy chunks)
```
Budgets in `angular.json` fail the build if the initial bundle exceeds 3 MB (warn at 1.5 MB).

## Troubleshooting
| Symptom | Fix |
|---|---|
| Blank page / network errors on `/api` | backend not running on `:4100` (dev) / `:4101` (e2e); check `curl localhost:4100/health` |
| CORS error in a custom setup | don't call the API cross-origin from dev — use the proxy; or add the origin to `CORS_ALLOWED_ORIGINS` |
| Logged out on every reload | `sessionStorage` blocked (private mode) → the refresh token can't survive a reload; sign in again |
| “Unable to initialize JavaScript cache storage … GLIBCXX” warning on build | harmless (lmdb build cache unsupported by the OS libstdc++); builds are just slower |
| Karma can't find Chrome | `export CHROME_BIN=/usr/bin/google-chrome` |
| Playwright “does not support chromium on ubuntu20.04” | `export E2E_CHANNEL=chrome` to use installed Google Chrome |
| `ng serve` ignores `angular.json`/`package.json` changes | restart the dev server |
| 500 on creating an employee with a blank location (custom clients) | backend bug: omit `workLocation` instead of sending `null` (see backend doc §6) |
| Port 4200/4100 already in use | stop the other process (`ss -ltnp \| grep 4200`) or pass `--port` |
| Education/experience “disappeared” | they are browser-local (no backend API yet): another browser/profile won't have them |
