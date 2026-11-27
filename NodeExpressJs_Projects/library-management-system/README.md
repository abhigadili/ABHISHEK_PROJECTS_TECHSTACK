# Library Management System

A database-driven library system: **Next.js 16** (App Router, React 19, TypeScript, Tailwind) talking over REST to an
**Express 4** API (TypeScript), persisting everything in **MySQL 8** (`library_management`).
Roles: **Admin**, **Librarian**, **Member** – enforced on the backend.

```
library-management-system/
├── backend/     Express API (routes + business logic + SQL), tests (Vitest/Supertest)
│   ├── src/modules/   auth, profile(+picture), members, staff, books, reference, circulation, reservations,
│   │                  finance, engagement, dashboard, reports, importer
│   ├── src/lib/       db (mysql2 pool/tx), fines (single fine calculator), reservations, membership, images, csv …
│   ├── src/middleware auth/RBAC, CSRF header, rate limits, error handler
│   ├── src/jobs/      maintenance job (reservation expiry, reminders, membership expiry)
│   ├── scripts/       db.ts (create|migrate|seed|reset), create-admin.ts
│   └── tests/         84 tests (unit + API integration against real MySQL)
├── frontend/    Next.js app (public site, /member area, /staff area incl. /staff/admin/*)
├── database/    migrations/ (versioned SQL) and seeds/ (development sample data)
├── e2e/         browser end-to-end script (puppeteer-core + Chrome)
├── docs/        API.md (endpoints & permissions) · DATABASE.md (schema, integrity, backup)
├── .env.example · .gitignore · README.md
```

## 1. Prerequisites
Node.js ≥ 20.9 (developed on 20.11), npm, MySQL 8 reachable from the API, Google Chrome (only for `e2e/`).

## 2. Install
```bash
cd backend  && npm install
cd ../frontend && npm install
```

**Shortcut:** a root `package.json` runs both apps together – `npm run install:all`, `npm run db:setup`, `npm run dev` (API + web in one terminal), `npm run build`, `npm start`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run e2e`.

## 3. Configure
```bash
cp backend/.env.example   backend/.env          # then edit DB_* and FRONTEND_ORIGIN
cp frontend/.env.example  frontend/.env.local   # NEXT_PUBLIC_API_URL (default http://localhost:4000/api/v1)
```
Every variable is documented in the `.env.example` files (MySQL host/port/db/user/password, API port, allowed frontend
origin, session cookie settings, upload limit, reset-token TTL, optional email provider placeholders).
`DB_ADMIN_USER` / `DB_ADMIN_PASSWORD` are used **only** by `db:create` to create the database and the least-privilege
application user (`DB_USER`); leave them empty if you create those yourself. If your MySQL enforces a password policy,
choose a strong `DB_PASSWORD`.

## 4. Database
```bash
cd backend
npm run db:create     # CREATE DATABASE library_management (+ application user when DB_ADMIN_* is set)
npm run db:migrate    # applies database/migrations/*.sql once each (tracked in schema_migrations)
npm run db:seed       # OPTIONAL, development only: catalogue sample data, copies and 3 demo users
```
`db:seed` prints the demo password (or uses `SEED_ADMIN_PASSWORD`): `admin@library.local`, `librarian@library.local`,
`member@library.local`. `npm run db:reset` drops and recreates the database (refuses when `NODE_ENV=production`).

### Create the first administrator securely (production)
Do **not** seed in production. There is no default password anywhere in the code:
```bash
cd backend
ADMIN_EMAIL=you@example.org ADMIN_NAME="Your Name" npm run admin:create   # hidden password prompt
# non-interactive: ADMIN_PASSWORD=... ; with neither, a strong password is generated and printed once
```
The password must satisfy the policy (8+ chars, upper, lower, digit) and is stored as a bcrypt hash. Further librarians
and admins are created by an admin under **Staff → Staff accounts**. Public registration can only create members.

## 5. Run
```bash
# terminal 1 – API (http://localhost:4000)
cd backend && npm run dev            # tsx watch; or: npm run build && npm start

# terminal 2 – web (http://localhost:3000)
cd frontend && npm run dev           # or: npm run build && npm start     (PORT=3100 npm start to change the port)
```
If you change the frontend port/origin, set `FRONTEND_ORIGIN` and `APP_BASE_URL` in `backend/.env` accordingly (CORS and
reset links). The frontend and backend run independently and meet only at `NEXT_PUBLIC_API_URL`.

## 6. Tests
```bash
cd backend && npm test               # 84 tests; rebuilds the throw-away database `library_management_test`
cd backend && npm run typecheck && cd ../frontend && npm run lint && npm run typecheck   # static checks
# browser end-to-end (needs API + web running on a freshly seeded dev DB: npm run db:reset && npm run db:seed)
cd e2e && npm install && WEB_URL=http://localhost:3000 DEMO_PASSWORD='<seed password>' npm test
```
`npm test` **drops and recreates `library_management_test`** on every run (never the main database).

## 7. Production build
```bash
cd backend  && npm run build && NODE_ENV=production npm start     # set COOKIE_SECURE=true behind HTTPS (+ TRUST_PROXY=true behind a proxy)
cd frontend && npm run build && npm start
```

## 8. What is implemented
* **Auth** – registration (member only, optional picture, unique generated member ID), login/logout, server-side sessions
  in an HttpOnly SameSite cookie (only a SHA-256 of the token is stored), password change, forgot/reset with single-use
  hashed expiring tokens, bcrypt hashing, account activation/suspension (kills live sessions), lockout after 5 failures
  plus per-route rate limits, strict CORS, Helmet headers, CSRF header guard, role middleware on every route.
* **Profile pictures** – multipart upload at registration and on the profile page; type + size + real content (magic
  bytes) validated server-side; stored in **MySQL `LONGBLOB`** (`user_images`, with MIME type, size, SHA-256); served by
  `GET /users/:id/picture` with correct `Content-Type`, `ETag` and private caching; preview, progress, replace, remove;
  default avatar; only the owner or authorised staff can change/see a picture. No file paths, no base64 in JSON.
* **Catalogue** – books with multiple authors/categories (normalised), ISBN-10/13 checksums (books without ISBN allowed),
  per-copy accession numbers, copy states (available / on loan / held / damaged / lost / withdrawn), archive instead of
  delete, search/filter/sort/paginate, related/recent/popular (from real loans), CSV bulk import, categories (hierarchy),
  authors, publishers.
* **Circulation** – issue / return / renew with transactional safety (a DB unique index makes double issue impossible),
  membership-type policies (limits, loan days, renewals, grace, fine/day, cap) stored in MySQL, overdue and balance
  blocks, lost/damaged handling, full history, notifications.
* **Reservations** – FIFO queue, one open reservation per member+book, returned copy is held for the first in line with an
  expiry, expiry/cancel passes it on, fulfilment on issue; consistent under concurrent requests (tested).
* **Fines & payments** – one calculator (`calculateOverdueFine`), waivers with reasons, manual charges, partial / full /
  multi-fine payments with allocations, receipts (printable), admin reversal records, audit trail, never deletes
  financial rows, no card data accepted.
* **Dashboards** (member / librarian / admin), **17 reports** with date filters, search, pagination and CSV export,
  **notifications**, favourites (reading list), reviews with optional moderation, settings, audit log, staff accounts,
  membership types & renewal/expiry, printable membership card and receipts.
* **Background job** (`src/jobs/maintenance.ts`, hourly in-process and via `POST /admin/jobs/run`): expires uncollected
  holds, due-soon and overdue reminders (deduplicated), membership expiry, session cleanup.

See [`docs/API.md`](docs/API.md) for every endpoint and who may call it, and [`docs/DATABASE.md`](docs/DATABASE.md) for
tables, relationships, integrity rules, backup and restore.

## 9. Test results (this build)
Executed on 2026-10-15 against MySQL 8.0 (`localhost:3306`):

| Check | Result |
|---|---|
| `backend` Vitest – 8 files, 84 tests (auth, picture storage & restart survival, catalogue, circulation, concurrency, reservations, fines, payments, authorisation, reports, import, settings, notifications) | **84 passed** |
| `backend` `tsc --noEmit` | passed |
| `frontend` `eslint src`, `tsc --noEmit`, `next build` (41 routes) | passed |
| Browser E2E (`e2e/run.mjs`, real Chrome, real API and MySQL): public pages, validation, registration **with picture**, picture replace/remove, profile edit, staff login, role redirect, issue via UI, renew, **reserve → queue → return → "ready"**, fine → partial payment → receipt, notifications, admin pages, book creation, mobile layout | **25 / 25 steps passed, 0 console errors** |
| Profile picture after a real API process restart | bytes identical to the uploaded file (served from MySQL) |

## 10. Known limitations / not verified
* **Email/SMS are not integrated.** Notifications are in-app only; password-reset links are logged / returned only in
  development (`EXPOSE_RESET_LINK`), so in production an admin must relay a link until a provider is wired in.
* **No payment gateway.** Payments are recorded by staff (cash/card-terminal/other + reference); membership fees shown
  on types are informational and not charged automatically.
* One role per user (no `user_roles` table). Overdue fines are created when the book is returned (while it is overdue the
  UI shows the fine that would apply today).
* Rate limiting and lockout counters: the limiter is in-memory per API process (use a shared store when scaling out);
  the account lockout is stored in MySQL. The maintenance job is idempotent, so several instances are harmless.
* The Next.js `proxy.ts` only checks that a session cookie exists; the real role/permission checks are in the API and in
  the role layouts. Cookies are not `Secure` unless `COOKIE_SECURE=true` – use HTTPS in production.
* E2E ran only on Chrome/Linux at 1280px and 390px widths; other browsers/screen readers were not tested.
  Accessibility basics (labels, focus, ARIA live regions, skip link) are implemented but no formal audit was done.
* Load/performance testing was not performed; search uses indexed `LIKE` queries (FULLTEXT index exists but is unused).
* Toolchain pins: Vitest 2 and TypeScript 5.9 (newer majors need a newer Node than 20.11).
