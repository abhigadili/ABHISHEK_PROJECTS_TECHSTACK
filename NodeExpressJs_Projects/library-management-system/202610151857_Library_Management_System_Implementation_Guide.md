# Library Management System — Implementation Guide

*How the system in this folder was built, file by file, with the reasoning behind the logic. The backend is covered in the most depth (Parts 3–5).*

**Stack:** Next.js 16 (App Router, React 19, TypeScript, Tailwind 3) · Express 4 (TypeScript, `mysql2`, `zod`) · MySQL 8 (`library_management`)
**Requirement source:** `~/claude-prompts/promptdo-15102026_2.md` (full-stack, database-driven library system; no mock data; pictures in MySQL).

---

## Contents

1. [What was asked and how the work was ordered](#1-what-was-asked-and-how-the-work-was-ordered)
2. [Architecture and the life of a request](#2-architecture-and-the-life-of-a-request)
3. [Database layer](#3-database-layer)
4. [Backend — shared infrastructure (config, lib, middleware)](#4-backend--shared-infrastructure)
5. [Backend — feature modules (every endpoint and its logic)](#5-backend--feature-modules)
6. [Backend — jobs, app assembly, scripts, tooling](#6-backend--jobs-app-assembly-scripts-tooling)
7. [Backend tests — what each file proves](#7-backend-tests)
8. [Frontend — every file and its logic](#8-frontend)
9. [Root package, e2e, docs, env files](#9-root-package-e2e-docs-env-files)
10. [Problems found and fixed along the way (change log)](#10-problems-found-and-fixed-change-log)
11. [How to run and verify](#11-how-to-run-and-verify)
12. [Known limitations](#12-known-limitations)

---

## 1. What was asked and how the work was ordered

The prompt required a *real* library system: catalogue, copies, members, three roles, registration with a profile picture stored **in MySQL**, circulation (issue / return / renew), reservations, fines and payments, dashboards, reports, notifications, audit logs, tests that actually run, and a documented setup. Express owns all business logic; Next.js only talks to it over HTTP.

Work followed the order the prompt prescribes:

| Step | What was done |
|---|---|
| 1. Inspect environment | Node 20.11.1, system MySQL 8.0.42, no root access. The system MySQL needed credentials, so a private `mysqld` was first started on port 3307 (data dir in the scratch area, because AppArmor blocks `$HOME`). Later the user pointed to the real MySQL on **3306** and authorised the login; the app was moved there. |
| 2. Structure & versions | Monorepo `backend/ frontend/ database/ docs/ e2e/`. TypeScript pinned to 5.9 and Vitest to 2.x because newer majors (TS 7, Vitest 5) fail on Node 20.11. |
| 3. Schema | One migration `001_init_schema.sql` (28 tables) designed so MySQL itself prevents the worst inconsistencies. |
| 4. Migrations & seed | `scripts/db.ts` (`create|migrate|seed|reset`) + `database/seeds/001_dev_catalog.sql`. |
| 5. Backend core | env validation, pool + transactions, errors, validation helpers, sessions/RBAC, CSRF header, rate limits. |
| 6. Registration + pictures | multipart registration, image sniffing, `LONGBLOB` storage, retrieval endpoint. |
| 7. Catalogue | books, copies, categories, authors, publishers, CSV import. |
| 8. Circulation & money | issue/return/renew, reservation queue, fines, payments, refunds. |
| 9. Dashboards / reports / notifications | live SQL statistics, 17 reports + CSV, in-app notifications, scheduler. |
| 10. Frontend | every screen wired to the real API. |
| 11. Tests | 84 backend tests (real MySQL) + 25-step Chrome end-to-end run. |
| 12. Fix, verify, document | the bugs listed in Part 10, README, `docs/API.md`, `docs/DATABASE.md`, this guide. |

---

## 2. Architecture and the life of a request

```
Browser (Next.js pages, React)
   │  fetch(NEXT_PUBLIC_API_URL + path, credentials:'include', header X-LMS-Client: web)
   ▼
Express app  (backend/src/app.ts)
   helmet → CORS (only FRONTEND_ORIGIN) → cookie-parser → json(100kb)
   └─ /api/v1 router
        apiLimiter → /health
        loadSession      (cookie → sessions → req.user)
        requireCsrfHeader (non-GET needs X-LMS-Client: web)
        module routers   (each route: rate limit? → role guard → zod parse → service SQL → audit/notify → { data })
   errorHandler (AppError → status/code; MySQL dup/deadlock mapped; everything else → generic 500)
   ▼
mysql2 pool (UTC session, parameterised queries, transactions)  →  MySQL `library_management`
```

Key decisions

* **Express is the only place with business rules.** Next.js route handlers are not used for data.
* **Cookie sessions, not JWT.** A random 32-byte token is the cookie value; the DB stores only `SHA-256(token)` in `sessions`. Logout, suspension and password change can therefore revoke access *immediately* (delete rows), which stateless JWTs cannot do.
* **Authorisation lives on the API.** The frontend hides things, but every route is guarded by `requireAuth` / `staffOnly` / `adminOnly` / ownership checks, and tests assert the 401/403 matrix.
* **Derived data is never stored.** Copy counts, balances and queue positions are computed from rows, so they cannot become inconsistent.
* **Money in `DECIMAL(10,2)`**, arithmetic through `round2()`; `decimalNumbers: true` makes mysql2 return numbers.
* **All times UTC.** Every pooled connection runs `SET time_zone='+00:00'`; `DATE` columns are returned as `YYYY-MM-DD` strings (`dateStrings:['DATE']`), `DATETIME` as JS `Date` → ISO.

Uniform response shapes: success `{ "data": … }` (lists add `meta{page,pageSize,total,totalPages}`); errors `{ "error": { code, message, details? } }` where `details` is a field→message map for validation errors.

---

## 3. Database layer

### 3.1 `database/migrations/001_init_schema.sql`
Applied once by `scripts/db.ts migrate`. It creates every table with InnoDB/utf8mb4, FKs, uniques and indexes, then inserts the **policy defaults the app needs to run** (roles, `library_settings`, four membership types) — *not* sample data.

Tables and why they look the way they do:

| Table | Notes on the design |
|---|---|
| `roles` | 3 fixed rows (admin=1, librarian=2, member=3). One role per user (no `user_roles`) — simpler and sufficient. |
| `users` | `email` unique; `status` ENUM(pending,active,suspended,inactive); `failed_login_count` + `locked_until` implement brute-force lockout in the DB. |
| `user_images` | **Profile picture** table: `user_id` PK/FK (`ON DELETE CASCADE`), `mime_type`, `size_bytes`, `sha256`, `data LONGBLOB`. Separate from `users` so list queries never drag image bytes. `sha256` doubles as the HTTP `ETag`. |
| `sessions` | PK = hash of cookie token; `expires_at`; index on `user_id` for "revoke all". |
| `password_reset_tokens` | `token_hash` unique, `expires_at`, `used_at` (single use). |
| `member_types` | The policy per membership type: `max_loans, loan_days, max_renewals, renewal_days, max_reservations, fine_per_day, grace_days, max_fine_per_loan, membership_days, membership_fee, is_active`. Nothing is hard-coded in code. |
| `member_profiles` | 1:1 with member users: unique `member_code`, DOB, gender, address fields, `registration_date`. |
| `memberships` | One row per **term** (history). The "current" membership is the non-cancelled row with the latest `end_date`. |
| `publishers`, `authors`, `categories` | Reference data with `status` active/archived (archive instead of delete). `categories.parent_id` self-FK gives hierarchy; unique `slug` and `name`. |
| `books` | Bibliographic record. `isbn10`/`isbn13` are **nullable unique** (MySQL allows many NULLs → books without ISBN are fine). FULLTEXT index exists (unused; search uses indexed `LIKE`). **No count columns.** |
| `book_authors`, `book_categories` | Normalised many-to-many (`book_authors.position` keeps author order). |
| `book_copies` | One row per physical copy; unique `accession_number`; `status` available / on_loan / held / damaged / lost / withdrawn. "held" = set aside for the first person in the reservation queue. |
| `loans` | Issue/due/return data, renewal count, `status` active/returned/lost, `return_condition`, staff who issued/returned. **Generated column** `open_copy_id = IF(status='active', copy_id, NULL)` with a UNIQUE key → at most one open loan per copy, enforced by MySQL. |
| `loan_renewals` | Renewal history (old/new due date, who). |
| `reservations` | status pending→ready→fulfilled/cancelled/expired; `copy_id` set while ready; `expires_at`. **Generated column** `open_key = IF(status IN ('pending','ready'), CONCAT(user_id,'-',book_id), NULL)` + UNIQUE → one open reservation per member and book. |
| `fines` | `fine_type` overdue/lost/damage/manual; `amount`, `waived_amount`, `paid_amount`; CHECK `waived+paid ≤ amount`; `status` outstanding/partial/paid/waived; creator and waiver staff ids. |
| `payments` | `kind` payment/refund, unique `receipt_number`, method, reference, `reverses_payment_id` (UNIQUE → a payment can be reversed once). CHECK `amount > 0`. |
| `payment_allocations` | How each payment was split across fines (supports partial and multi-fine payments). |
| `notifications` | In-app notifications; unique nullable `dedupe_key` so scheduled reminders are idempotent (`INSERT IGNORE`). |
| `favorites`, `reviews` | Reading list; ratings (CHECK 1–5, unique per user+book, `status` for optional moderation). |
| `library_settings` | Typed key/value policy and contact info (`string/number/boolean/text`). |
| `audit_logs` | `actor_id, action, entity_type, entity_id, details JSON, ip_address`. |

Seeded settings (editable by admin): library name/address/phone/email/hours/about, currency symbol, `registration_requires_approval`, `default_member_type_id`, `block_borrowing_if_overdue`, `max_outstanding_balance`, `lost_book_default_charge`, `lost_book_processing_fee`, `damage_default_charge`, `reservation_hold_days`, `due_soon_days`, `review_moderation`.
Seeded membership types: Student (5 loans/14 d), Faculty (10/30 d, 3 grace days), General (5/14 d, $0.50/day, cap $20, id 3 = default), Premium (15/28 d).

### 3.2 `database/seeds/001_dev_catalog.sql`
Generated SQL for development: 8 publishers, 12 authors, 11 categories (two-level), 13 books (one deliberately **without ISBN** to prove local books work) with their author/category links. Copies and users are created by code (next section) because they need generated accession numbers and password hashes.

### 3.3 `backend/scripts/db.ts`
* `createDb()` — connects with `DB_ADMIN_USER/PASSWORD` (or the app user), `CREATE DATABASE IF NOT EXISTS … utf8mb4`; if an admin user is configured it also `CREATE USER IF NOT EXISTS` the application user and `GRANT ALL ON library_management.*` to it. Identifiers go through `ident()` (whitelist regex) because DDL cannot take placeholders.
* `migrate()` — creates `schema_migrations`, reads `database/migrations/*.sql` sorted, runs each not-yet-recorded file (`multipleStatements`), records it.
* `seed()` — **refuses if `books` is not empty**; runs the catalogue SQL; for each book inserts 2–3 copies with accession `ACC-<bookId padded to 5>-<n>`; creates three demo users (admin / librarian / member) with one bcrypt hash of `SEED_ADMIN_PASSWORD` or a random printed password; the member also gets a profile (`LM<year><id padded 6>`) and an active General membership.
* `reset()` — drop + create + migrate; **throws when `NODE_ENV=production`**.
* Runs as a CLI (`create|migrate|seed|reset`) and exports the functions (the test setup imports them).

### 3.4 `backend/scripts/create-admin.ts`
Production-safe first administrator. Needs `ADMIN_EMAIL`; password comes from `ADMIN_PASSWORD`, else a **hidden terminal prompt**, else a generated one printed once. Validated with the same `passwordSchema`, hashed with bcrypt, inserted as role 1. No default password exists anywhere.

---

## 4. Backend — shared infrastructure

All paths are under `backend/`.

### 4.1 `package.json`, `tsconfig.json`, `vitest.config.ts`
* Scripts: `dev` (tsx watch), `build` (tsc → `dist/`), `start` (`node dist/src/server.js`), `typecheck`, `db:create|migrate|seed|reset`, `admin:create`, `test`.
* Dependencies: `express@4, mysql2, zod, bcryptjs, cookie-parser, cors, helmet, express-rate-limit, multer, dotenv`; dev: `typescript@5.9, tsx, vitest@2, supertest`, types.
* `tsconfig.json`: CommonJS, strict, `rootDir "."` (so `dist/src`, `dist/scripts`, `dist/tests`).
* `vitest.config.ts`: `fileParallelism:false` (one shared test DB), env override → `NODE_ENV=test`, `DB_NAME=library_management_test`, rate limits and jobs off, `EXPOSE_RESET_LINK=true`, `MAX_UPLOAD_BYTES=200000`, and pinned `FRONTEND_ORIGIN/APP_BASE_URL=http://localhost:3000` so CORS tests do not depend on a developer's `.env`.

### 4.2 `src/config/env.ts`
Loads `backend/.env` from `process.cwd()` (works for both `src` and `dist` runs; `quiet:true`), validates with a zod schema (types, defaults), and **exits with a readable message on invalid config**. Exports `env` and `isProd`. Notable variables: DB_*, `DB_ADMIN_*` (only for `db:create`), `FRONTEND_ORIGIN` (comma list), `COOKIE_SECURE`, `TRUST_PROXY`, `RATE_LIMIT_ENABLED`, `MAX_UPLOAD_BYTES`, `PASSWORD_RESET_TTL_MINUTES`, `EXPOSE_RESET_LINK` (dev only), `JOBS_ENABLED`. Warns if production runs without `COOKIE_SECURE`.

### 4.3 `src/lib/db.ts`
* `poolConfig`: mysql2 pool, `timezone:'Z'`, `dateStrings:['DATE']`, `decimalNumbers:true`, utf8mb4, single statements only (no stacked queries).
* `getPool()` creates the pool lazily and on every new connection runs `SET time_zone='+00:00'`.
* `query / queryOne / exec` take **only parameterised SQL** (`?` placeholders → SQL-injection safe) and accept an optional connection so the same helpers work inside transactions.
* `withTx(fn)` — `beginTransaction` → `fn(conn)` → `commit`; any throw → `rollback`; always `release`. Every multi-step operation uses it.

### 4.4 `src/lib/errors.ts`
`AppError(status, code, message, details)` plus factories `badRequest 400`, `unauthorized 401`, `forbidden 403`, `notFound 404`, `conflict 409`, `unprocessable 422` (business-rule violation). Services throw these; the error middleware renders them.

### 4.5 `src/lib/http.ts`
* `wrap(fn)` forwards async errors to Express.
* `parse(schema, data)` zod-validates; on failure throws 400 with `details = {field: firstMessage}` (what the frontend maps onto form fields).
* `ok()`, `page()` response helpers; `pagination(query)` clamps `page ≥ 1`, `pageSize` 1..max.
* `idParam()` validates numeric route params; `clientIp()`.
* Zod building blocks: `emptyToNull`, `optStr(max)`, `isoDate`, `optDate`, `money` (non-negative, ≤1,000,000, rounded to cents) — empty strings from forms become `null`.

### 4.6 `src/lib/dates.ts`
`todayStr()`, `addDays()`, `diffDays()` (UTC midnight maths, avoids DST bugs), `round2()`.

### 4.7 `src/lib/settings.ts`
`getSettings(conn?)` reads `library_settings` **on every call** (tiny table) and converts by `value_type`. Reading live means an admin edit applies to the very next request with no cache invalidation.

### 4.8 `src/lib/audit.ts` and `src/lib/notify.ts`
* `audit(req, actorId, action, entityType, entityId, details, conn?)` inserts into `audit_logs` (JSON details, IP). It can take the transaction connection so the audit row commits/rolls back with the action.
* `notify(userId, type, title, message, link, conn?, dedupeKey?)` — `INSERT IGNORE` into `notifications`; with a `dedupeKey` a repeated reminder is silently skipped. No email/SMS is sent (none is configured, and nothing claims delivery).

### 4.9 `src/lib/password.ts`
bcryptjs (cost 12; 4 in tests for speed), `sha256()`, `randomToken()` (crypto, base64url), and `passwordSchema` (8–72 chars, lower+upper+digit — 72 is bcrypt's byte limit).

### 4.10 `src/lib/images.ts`
* `sniffImage(buffer)` checks **magic bytes** for JPEG (`FF D8 FF`), PNG (8-byte signature) and WebP (`RIFF…WEBP`); the browser-supplied mimetype is never trusted for the stored type.
* `validateImage(file)` enforces size (`MAX_UPLOAD_BYTES`) and a successful sniff; returns `{mime,size,sha,data}`.
* `upload` = multer **memory storage** (nothing touches disk), 1 file, mimetype pre-filter → fast 400 for obvious wrong types. `csvUpload` for the CSV importer (2 MB).

### 4.11 `src/lib/membership.ts`
* `getMemberPolicy(userId, conn?)` → joins the user's current membership term with its `member_types` row and computes `expired` (status expired or `endDate < today`). This single function feeds borrowing limits, loan days, fine rules, UI displays.
* `startMembership(conn, userId, typeId, createdBy, notes, startFrom?)` inserts a new term (`end = start + membership_days`).

### 4.12 `src/lib/access.ts`
`assertCanManageUser(actor, targetId)` — self always; admin anything; librarian only **members**; everyone else 403 (used for pictures). `assertSelfOrStaff()` for "members see only their own records".

### 4.13 `src/lib/fines.ts`  *(the single fine calculator)*
`calculateOverdueFine({dueDate, returnDate, finePerDay, graceDays, maxFinePerLoan})`:
```
daysOverdue    = max(0, returnDate − dueDate)
chargeableDays = max(0, daysOverdue − graceDays)
amount         = round2(chargeableDays × finePerDay), capped at maxFinePerLoan
```
Also `fineStatus()` (derives outstanding/partial/paid/waived from amount, waived, paid), `memberBalance()` (SUM of unpaid), `createFine()` (insert + notification; zero amounts create nothing). Both circulation (at return) and the loan list (estimate for overdue loans) use the same function — rules are not duplicated.

### 4.14 `src/lib/reservations.ts`
* `allocateForBook(conn, bookId)` — **the queue engine.** Loops: lock the oldest `pending` reservation (`FOR UPDATE`, ordered by `created_at,id`) and lock an `available` copy (`FOR UPDATE SKIP LOCKED`); if both exist the copy becomes `held`, the reservation becomes `ready` with `copy_id`, `ready_at`, `expires_at = now + reservation_hold_days`, and the member is notified. Repeats until queue or stock runs out. Called after returns, cancellations, expiries, adding copies, and copy status changes.
* `releaseReservation(conn, id, 'expired'|'cancelled')` — closes it; if it was `ready` the held copy goes back to `available` and `allocateForBook` immediately offers it to the next member.
Because rows are locked inside a transaction, two simultaneous returns cannot give the same copy to two members.

### 4.15 `src/lib/slug.ts` and `src/lib/csv.ts`
* `slugify`, `validIsbn10` (mod 11 weighted checksum, `X` = 10), `validIsbn13` (mod 10, weights 1/3).
* `parseCsv` — small RFC-4180 parser (quotes, escaped quotes, CRLF, BOM); `csvCell`/`toCsv` quote output and **neutralise spreadsheet formula injection** (cells starting with `= + - @` get a leading `'`).

### 4.16 `src/middleware/auth.ts`
* `loadSession` — reads the cookie, hashes it, joins `sessions → users → roles` where `expires_at > UTC_TIMESTAMP()` and user status is `active|pending`. A suspended/inactive account therefore stops working on the next request even with a valid cookie. Sets `req.user` (`id,email,fullName,role,status`).
* `requireAuth` (401), `requireActive` (pending accounts may browse but not transact), `requireRole(...roles)`, `staffOnly`, `adminOnly`, `isStaff`.
* `requireCsrfHeader` — every non-GET/HEAD/OPTIONS request must carry `X-LMS-Client: web`. With `SameSite=Lax` cookies, strict CORS and a custom header (which cross-site forms cannot send), CSRF is blocked in depth.

### 4.17 `src/middleware/errors.ts`
`notFoundHandler` (404 JSON), `errorHandler`: `AppError` → its status; `MulterError` → 400 ("File is too large"); bad JSON → 400; MySQL `ER_DUP_ENTRY` → 409; `ER_LOCK_DEADLOCK` → 503 "try again"; anything else → logged server-side and returned as a generic 500 (no stack, no SQL).

### 4.18 `src/middleware/rateLimit.ts`
`express-rate-limit` presets: `authLimiter` (30/15 min), `registerLimiter` (20/h), `resetLimiter` (10/h), `apiLimiter` (600/min); all skipped when `RATE_LIMIT_ENABLED=false` (tests); JSON 429 body.

---

## 5. Backend — feature modules

Each file in `src/modules/` exports one or more routers mounted in `app.ts`. The pattern in every handler: **guard → validate (zod) → check rules / lock rows (inside a transaction when several writes) → write → audit/notify → respond**.

### 5.1 `modules/auth.ts` — `/auth`
* **Shared schema `memberFields`** (name, email, phone, DOB, gender, address, city, state, postalCode, country). `registrationSchema` extends it with `password`, `confirmPassword`, optional `memberTypeId`, and refinements (passwords match, DOB in the past). Staff-side member creation reuses `memberFields`, so rules are identical.
* `POST /register` (rate-limited, multipart with optional `picture`):
  1. validate fields; `validateImage()` (size + magic bytes);
  2. resolve membership type (`memberTypeId` or the `default_member_type_id` setting; must be active);
  3. reject duplicate email (also protected by the unique key → 409);
  4. status = `pending` if `registration_requires_approval` else `active`;
  5. **one transaction:** insert `users` (role fixed to 3 — the body can never choose a role), insert `member_profiles` with generated `LM<year><id 6 digits>` (unique), start a membership term, insert `user_images` if a picture was sent, add a welcome notification;
  6. audit; if active, create a session (auto-login). Response includes `pendingApproval`.
* `POST /login` (rate-limited): look up user; if `locked_until` is in the future → 429; always run a bcrypt compare (against a dummy hash if the email is unknown, so timing does not reveal accounts); wrong password → increment `failed_login_count`, on the 5th failure set `locked_until = now + 15 min` and reset the counter, audit the lockout, return the *same* generic 401; correct password → 403 for suspended/inactive, else reset counters, set `last_login_at`, create session.
* `createSession` stores `sha256(token)`, expiry (`SESSION_TTL_HOURS`), IP, user-agent; `setSessionCookie` sets `HttpOnly`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE`, `path=/`.
* `POST /logout` deletes the session row and clears the cookie. `GET /me` returns `publicUser()` (profile data, `hasPicture`, membership policy — never the hash).
* `POST /change-password`: verifies the current password, forbids reusing it, hashes the new one, **deletes every other session**, audits.
* `POST /forgot-password` (rate-limited): for an active/pending account invalidates older tokens, stores `sha256(token)` with expiry, logs the link in non-production and returns `devResetLink` **only** when `EXPOSE_RESET_LINK` and not production; the response is identical for unknown emails (no account enumeration).
* `POST /reset-password`: in a transaction selects the unused, unexpired token `FOR UPDATE`, marks it used, sets the new hash, clears lockout, deletes all that user's sessions.

### 5.2 `modules/profile.ts` — `/profile`, `/users/:id/picture`
* `GET/PATCH /profile` — own details. `applyProfileUpdate()` builds `UPDATE` statements from **fixed column maps** (user input never becomes a column name) and only touches fields that were sent (`undefined` = untouched, `null` = clear).
* **Picture endpoints** (the core requirement):
  * `GET /users/:id/picture` — allowed for the owner or staff (`assertCanManageUser`); reads `mime_type,size_bytes,sha256,data` from `user_images`; sends `Content-Type` (the sniffed type), `Content-Length`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=0, must-revalidate` and `ETag` = SHA-256; answers **304** when `If-None-Match` matches.
  * `PUT /users/:id/picture` — multipart; validated; `INSERT … ON DUPLICATE KEY UPDATE` so upload and replace are the same call; audited with size/mime.
  * `DELETE` — removes the row. Ownership rule: self, or librarian→members, admin→anyone.

### 5.3 `modules/members.ts` — `/members` (staff + self)
* `GET /members` (staff): search `q` (name/email/code/phone, `LIKE` with escaped wildcards), `status`, `typeId`; a join returns current membership type/end, active loan count, outstanding fines, `hasPicture`; paginated via `COUNT(*)` over the same query.
* `POST /members` (staff): same field rules as registration, **member type required**, optional password — if omitted a temporary password (`randomToken + "A1"`) is generated and returned once; optional picture; transaction identical to registration.
* `GET /members/:id` (self or staff) / `PATCH` (staff: details + email with duplicate check).
* `POST /members/:id/status` — `active|suspended|inactive`; a reason is mandatory when not activating. In one transaction: update user, flip current membership between active/suspended, **delete the member's sessions** when deactivating, send an "account status changed" notification; audited with the previous status.
* `POST /members/:id/membership` — renew/change: marks existing active terms `expired`, then `startMembership`. If the type is unchanged and the term is still valid the new term **starts at the old end date** (renewal extends); otherwise it starts today. History is retained (`GET /members/:id/memberships`).

### 5.4 `modules/memberTypes.ts` — `/member-types`
`GET /` public (active only — registration form needs it), `GET /all` (admin, with active-member counts), `POST`, `PUT /:id` (admin). A zod schema validates every numeric policy field; these rows drive loan periods, limits, renewals and fine rules everywhere else.

### 5.5 `modules/staff.ts` — `/staff` (admin only, router-level guard)
List/search; `POST` creates librarian/admin (temp password if none given); `PATCH` name/phone/role — **cannot demote yourself**; `POST /:id/status` — cannot deactivate yourself and cannot remove the **last active admin**; deactivation deletes sessions; `POST /:id/reset-password` generates a temp password and revokes sessions. Everything audited.

### 5.6 `modules/reference.ts` — categories, authors, publishers
Three routers with the same shape: public/authenticated reads (staff can pass `all=1` to see archived), staff create/update, **admin delete**.
* **Delete = archive when in use**: a category with books or children, an author with books, a publisher with books → `status='archived'` and the response says so; otherwise a real delete.
* Categories: slug auto-generated (`slugify`), unique name/slug checks, `assertNoCycle()` walks parents to prevent loops; book counts are live subqueries.
* Authors/publishers: URL/email validation (`http(s)` only), detail endpoints list associated active books.

### 5.7 `modules/books.ts` — `/books`, `/copies`
* **`BOOK_LIST_SQL`** is the heart of the catalogue: one query joining publisher, per-book **aggregated copy counts** (`SUM(status=…)` over `book_copies`), loan counts (popularity) and approved review averages. `shape()` converts to numbers and derives `availability` (`available` / `borrowed` / `unavailable`).
* `GET /books` filters: `q` (title, subtitle, description, exact ISBN, author name, category name, publisher), `title`, `isbn`, `author`, `authorId`, `categoryId` (includes child categories), `publisherId/publisher`, `language`, `format`, `yearFrom/To`, `availability`; whitelist `sort` (`title|newest|year|popularity|availability`); only staff may request `status=archived|all`. Every value is a bound parameter; the sort key is looked up in a map (no string interpolation of user input).
* `GET /books/recent|popular|languages`; `GET /:id` adds author/category lists, related books (shared category or author), and — when signed in — `isFavorite`, `myReservation`, `myActiveLoan`; `acquisitionCost` is removed for non-staff.
* `POST /books` / `PUT /:id` (staff): ISBNs normalised and checksum-validated (`isbnField`), referenced authors/categories/publisher must exist, ISBN uniqueness pre-checked for a field-level 409, then **`setLinks()`** synchronises authors/categories by **diffing** (insert missing, delete removed, update positions). *(A blanket `DELETE` + re-insert deadlocked under concurrent creates in testing — see Part 10.)* `addCopies()` creates N copies with generated accession numbers (`ACC-<book>-<n>`, next number from the current max) or one caller-supplied number (uniqueness checked), then calls `allocateForBook` so new stock can satisfy waiting reservations.
* Archive/restore: archive refused (422) while loans are active or reservations open. Hard `DELETE` (admin) only if there is **no** loan/reservation history; otherwise the user is told to archive.
* Copies: `GET/POST /books/:id/copies`; `PATCH /copies/:id` changes status to available/damaged/lost/withdrawn — **refused for on-loan copies**; moving a `held` copy away returns its reservation to `pending`; `allocateForBook` then re-balances. `DELETE /copies/:id` only for copies with no loan history (else "withdraw instead").

### 5.8 `modules/importer.ts` — `/books/import`
Staff CSV import, **all-or-nothing**: parse → validate every row (required `title`,`authors`; ISBN checksums; year/pages/format/copies ranges; duplicates inside the file and against the DB) → if any row is invalid return 422 with a row-by-row error list and write nothing; `?dryRun=1` validates only; otherwise one transaction creates missing authors/categories/publishers (`findOrCreate`), books, links and copies. Max 1000 rows. `GET /template` returns the header row.

### 5.9 `modules/circulation.ts` — `/loans`
* **`LOAN_SQL`** joins loan, member, book, copy, staff names and the member's current membership type so each row can carry `isOverdue`, `daysLate`, and `estimatedFine` (via `calculateOverdueFine`) and a `displayStatus`.
* `GET /loans` (staff; filters status/q/memberId/bookId/date range), `GET /loans/mine` (own; `memberId` is ignored for members), `GET /loans/:id` (owner or staff; includes renewals and fines).
* **`assertCanBorrow(conn, userId, settings)`** — one function for every eligibility rule: user active; has a membership; not suspended; **not expired**; no overdue loans (if `block_borrowing_if_overdue`); unpaid balance `< max_outstanding_balance`; active loans `< maxLoans` (skipped for renewals).
* **`POST /loans/issue`** (staff), single transaction:
  1. resolve member (id or member code) and **`SELECT … FOR UPDATE` the member row** — concurrent issues to the same member serialise, so the limit cannot be raced;
  2. eligibility via `assertCanBorrow`;
  3. resolve and lock the copy: by id/accession, or by book — preferring a copy *held for this member*, otherwise first `available` copy with `SKIP LOCKED`;
  4. rules: book must be active; a `held` copy only goes to the member whose `ready` reservation holds it; member cannot already have this book on loan;
  5. due date = today + `loan_days` (or staff-chosen 1–365 days);
  6. insert loan, set copy `on_loan`; fulfil the member's own reservation (and free a different held copy and re-allocate if there was one); notify.
  Even if all of the above were bypassed, the unique `open_copy_id` index would reject a second open loan on the copy.
* **`POST /loans/return`** (by `loanId` or accession number) → `processReturn()` in a transaction: lock loan + copy; compute the overdue fine with the member's policy; `lost` → fine = (acquisition cost or default) + processing fee, copy `lost`, loan `lost`; `damaged` → damage charge (given or default), copy `damaged`; `good` → copy `available`; stamp `returned_at`, condition, staff; **`allocateForBook`** hands the copy to the next waiting member; notify the borrower. Returning twice → 422.
* **`POST /loans/:id/renew`** (owner or staff, active account): loan must be active; `assertCanBorrow(forRenewal)`; `renewal_count < maxRenewals`; not overdue (when blocking is on); **no other member waiting** (pending/ready reservation); new due = `max(due, today) + renewal_days`; writes `loan_renewals`, updates the loan, notifies.

### 5.10 `modules/reservations.ts` — `/reservations`
* `GET /` (staff) and `GET /mine`; each row carries `queuePosition` (count of earlier pending rows) for pending items.
* `POST /` (active members, or staff on behalf of a member): in a transaction lock the member, check a valid membership, lock the book; **reject if any copy is available** (borrow instead) or if the book has no circulating copies; reject if already on loan or already reserved; enforce `maxReservations`; insert `pending`. The unique `open_key` backs the duplicate rule.
* `POST /:id/cancel` — owner or staff → `releaseReservation(…, 'cancelled')`, so a held copy flows to the next person at once.

### 5.11 `modules/finance.ts` — `/fines`, `/payments`
* Fines: `GET /` (staff, filters), `GET /mine` (+ outstanding balance in `meta`), `GET /balance/:memberId`, `POST /` manual/damage/lost charge, `POST /:id/waive` (reason mandatory; partial or full; amount ≤ outstanding; recomputes status; notifies; audited).
* **`POST /payments`** (staff): in one transaction lock the member row and **lock the payable fine rows `FOR UPDATE`** (oldest first, or only `fineIds`); total due is recomputed under the lock; amount must be `> 0` and `≤ due`; insert the payment with a temporary receipt number, then rename to `RCPT-YYYYMMDD-<id 6>` (unique); apply the amount fine by fine (`paid_amount`, `status` via `fineStatus`), writing a `payment_allocations` row per fine; notify with the remaining balance. Reference and notes are checked so a **card-number-looking string (13–19 digits) is rejected** — the system never stores card data. Concurrent payments are safe: the second waits on the locks and then fails the "exceeds outstanding" check instead of over-paying.
* `GET /payments`, `/mine`, `/:id` (owner or staff; returns allocations + library info for the printable receipt).
* **`POST /payments/:id/refund`** (admin only): locks the payment; only `kind=payment` and not already reversed; inserts a `kind=refund` row linked by `reverses_payment_id` (UNIQUE), re-opens each allocated fine's `paid_amount`, notifies. **Nothing is deleted** — originals and reversals both remain.

### 5.12 `modules/engagement.ts`
* **Notifications** (`/notifications`): list (with unread count in `meta`), `unread-count`, `read-all`, `:id/read` — all scoped to `user_id = req.user.id`, so another member's id returns 404.
* **Favorites** (`/favorites`): list / `PUT :bookId` (`INSERT IGNORE`) / `DELETE`.
* **Reviews** (`/reviews`): public list per book (approved, plus the viewer's own pending), `PUT /book/:bookId` (members only; **must have borrowed the book**; one per member; status `pending` if `review_moderation` is on), delete (own or staff), staff moderation queue + `POST /:id/moderate`.
* **Settings** (`/settings`): `GET /public` (contact/about), `GET /` (staff), `PUT /` (admin): each key must exist; value validated by its type (non-negative numbers, `true|false`, length ≤ 1000); audited with the changed keys.
* **Audit log** (`/audit-logs`, admin): filters `action` (prefix), `entityType`, `actorId`, date range; paginated.

### 5.13 `modules/dashboard.ts`
* `GET /dashboard/staff`: ~16 scalar `COUNT/SUM` queries (titles, copies by state, members, active loans, overdue, pending reservations, outstanding fines, payments collected net of refunds, today's payments, pending reviews), recent issued/returned, popular books, **12-month trends** (issued, returned, new members, cumulative members — zero-filled in code), and loans by category. Nothing hard-coded.
* `GET /dashboard/member`: own profile, membership policy, active loans (with `daysLeft`, overdue and due-soon splits), recent returns, open reservations, balance, last 5 notifications.

### 5.14 `modules/reports.ts` — `/reports`
A registry `REPORTS` of 17 definitions; each has a `build(filters)` that returns a **parameterised SELECT** (date range via `range()`, search via escaped `LIKE`). The same definition serves the paged JSON view (`COUNT(*)` over the query + `LIMIT/OFFSET`) and the CSV export (`format=csv`, capped at 50 000 rows, `Content-Disposition` attachment, formula-injection-safe, export **audited**). Reports: inventory, availability, books-by-category/author/publisher, issue-return-history, current-loans, overdue-loans, member-borrowing, most-borrowed, inactive-books, lost-damaged, outstanding-dues, fine-collection, payment-history, membership-registrations, membership-expirations. Router-level `requireAuth + staffOnly` means CSV has exactly the same permissions as the screen.

---

## 6. Backend — jobs, app assembly, scripts, tooling

### 6.1 `src/jobs/maintenance.ts`
`runMaintenance()` handles everything that depends on time passing, and is **idempotent** (conditional updates + `dedupe_key`), so running twice or from two processes is harmless:
1. **Expired holds** — `ready` reservations with `expires_at < now` → `releaseReservation('expired')` (copy offered to the next member) + "reservation expired" notification.
2. **Due-soon reminders** — active loans due within `due_soon_days`; key `due-soon:<loan>:<due date>`.
3. **Overdue notices** — one per loan per day; key `overdue:<loan>:<date>`.
4. **Membership expiry** — active terms with `end_date < today` → `expired` + notification (`mem-expired:<id>`); reminder 7 days before (`mem-soon:<id>`).
5. **Housekeeping** — delete expired sessions and old reset tokens.
`startScheduler()` runs it 5 s after boot and hourly; admins can trigger it with `POST /admin/jobs/run` (also used by tests).

### 6.2 `src/app.ts`
`createApp()` builds the Express app: `x-powered-by` off; **helmet** (CSP `default-src 'none'`, `frame-ancestors 'none'`, same-site CORP, no referrer); **CORS** restricted to `FRONTEND_ORIGIN` with credentials, methods and headers whitelisted; cookie-parser; JSON/urlencoded limited to 100 kB. Under `/api/v1`: `apiLimiter`, `/health` (DB ping), then `loadSession` and `requireCsrfHeader`, then all routers. **Order matters:** `/books/import` is mounted before `/books`. Finally the 404 and error handlers. Exporting a factory (not a listening server) lets tests import the app directly.

### 6.3 `src/server.ts`
Fails fast if MySQL is unreachable (`SELECT 1`), listens on `PORT`, starts the scheduler when `JOBS_ENABLED`, closes the HTTP server and pool on SIGINT/SIGTERM.

### 6.4 Environment files
`backend/.env.example` documents every variable (DB, admin-only DB bootstrap login, origins, cookie flags, uploads, reset TTL, dev-only reset link exposure, jobs, optional email placeholder, seed password). `backend/.env` is local and git-ignored; `DB_ADMIN_*` was blanked after setup. Note: dotenv treats `#` as a comment in unquoted values, so a `DB_PASSWORD` with `#` must be quoted.

---

## 7. Backend tests

All in `backend/tests/`, run with `npm test`. `globalSetup.ts` **drops and recreates `library_management_test`**, migrates and seeds it, so tests exercise the real schema and real MySQL (no mocks). `helpers.ts` provides one real listening HTTP server (supertest otherwise spins up a server per request and breaks nested calls), a cookie-keeping `client()` that always sends the CSRF header, `login()`, `newMember()` (registers through the public API), `newBook()`, `issue()`, `setDue()` (back-dates a due date in SQL to create overdue cases) and sample PNG/JPEG/WebP bytes.

| File | Tests | What it proves |
|---|---|---|
| `fines.unit.test.ts` | 9 | Fine calculator (on-time, per-day, grace, cap, rounding), `fineStatus`, date maths, ISBN checksums, image sniffing. |
| `auth.test.ts` | 15 | Registration with/without picture (**bytes in MySQL equal the upload**), fake image rejected, oversize/wrong type rejected, field errors, duplicate email (case-insensitive), role cannot be chosen, login/logout invalidates server session, cookie flags, token stored hashed, generic failures, **lockout after 5 failures**, suspension kills sessions, CSRF header required, change-password revokes other sessions, forgot/reset (single use, expiry, hashed). |
| `profile.test.ts` | 5 | Profile read/update, picture upload → correct headers/ETag/304 → replace → remove, validation, ownership matrix (member vs member 403, librarian ok, librarian vs admin 403, anonymous 401), **survives a "restart"** (pool closed, brand-new app instance). |
| `catalog.test.ts` | 9 | Book create with copies, books without ISBN, invalid/duplicate ISBN, edit replaces links, member 403, search/filter/sort/pagination/no-match/SQL-injection-as-text, availability + popularity from real loans, copy counts always equal `book_copies`, delete/archive rules with history, category/author/publisher CRUD + archive-instead-of-delete + cycle check. |
| `circulation.test.ts` | 17 | Issue (due date, staff, notification), eligibility rules, **limit enforced and rolled back**, **concurrent double issue → exactly one winner**, concurrent issues to one member respect the limit, suspended/expired/overdue/unpaid-fines blocks and recovery, maintenance expiry idempotency, returns, overdue fine amounts, grace period, cap, lost/damaged charges, renewals (limit, overdue, reserved by another, others' loans, closed loans), full reservation queue (queue positions, held copy, cancel passes it on, fulfilment), hold expiry, concurrency on reservations. |
| `finance.test.ts` | 8 | Manual fines, partial → full payments with receipts and allocations, multi-fine oldest-first / selected fines, **concurrent payments cannot over-apply**, waivers (reason required, partial/full, audit), admin-only reversal restoring balances once, card-number rejection, per-member visibility. |
| `authz.test.ts` | 8 | Anonymous 401 on protected routes but public catalogue works; members 403 on all staff endpoints; librarian vs admin-only; cross-member data access (loans, members, notifications); staff-account protections; malformed input and error shape; CORS only for the configured origin; password hashes never leak. |
| `operations.test.ts` | 13 | Dashboard numbers equal SQL counts and move with data; member dashboard isolation; all 17 reports respond, filters work; CSV headers + formula-injection neutralised + 403/401; CSV import valid / invalid (nothing written) / dry-run; settings change takes effect immediately and is audited; audit entries; membership-type edits drive loan days/limits; staff member registration; notifications; favourites; reviews incl. moderation. |

**Result: 8 files, 84 tests, all passing** (also `tsc --noEmit` clean).

---

## 8. Frontend

`frontend/` — Next.js 16 App Router, Tailwind 3, `react-hook-form` + `zod` (+ `@hookform/resolvers`), `lucide-react`, `recharts`. All data comes from the Express API; the browser calls it directly with the session cookie.

### 8.1 Config
`package.json` (scripts `dev build start typecheck lint`), `tsconfig.json` (`@/*` → `src/*`), `next.config.mjs` (security headers, Turbopack root), `tailwind.config.ts` (brand palette), `postcss.config.mjs`, `eslint.config.mjs` (Next config; `no-img-element` and `set-state-in-effect` rules relaxed for avatars/covers and fetch hooks), `.env.example` (`NEXT_PUBLIC_API_URL`), `.gitignore`.

### 8.2 Core libraries (`src/lib`, `src/hooks`)
| File | Logic |
|---|---|
| `lib/api.ts` | `fetch` wrapper: base URL, `credentials:'include'`, `X-LMS-Client: web`, JSON or `FormData`; unwraps `{data}`; throws `ApiError(status, code, message, fields)` — `fields` is the server's per-field validation map. Also `getPaged`, `download` (authenticated CSV/file download via blob), `qs()` query builder, `uploadWithProgress()` (XHR so uploads can show progress), `pictureUrl()`. |
| `lib/auth.tsx` | `AuthProvider`/`useAuth`: loads `/auth/me` on start, `login`, `logout`, `refresh`; `homeFor(user)` chooses the role's landing page. |
| `lib/types.ts`, `format.ts`, `schemas.ts` | API types; money/date helpers; shared zod rules mirroring the backend (password policy, phone, member fields). |
| `hooks/useApi.ts` | `useApi` / `usePaged` (loading/error/reload, stale-response guard), `useDebounced`, `errMsg`. |
| `hooks/useServerForm.ts` | `useServerSubmit(form)` — runs a submit, maps `ApiError.fields` onto react-hook-form fields and keeps a form-level message and busy flag. |
| `proxy.ts` | Next 16 "proxy" (formerly middleware): `/member`, `/staff`, `/receipt` redirect to `/login?next=…` when no session cookie exists. First line of defence only; the layouts re-check the role and the API enforces everything. |

### 8.3 Shared components (`src/components`)
* `ui/index.tsx` — design system: `Button`, `TextInput/Select/TextArea/Checkbox` (accessible labels, `aria-invalid`, error text), `Card`, `PageHeader`, `Stat`, `Badge/StatusBadge` (consistent colours for available/borrowed/overdue/reserved/unavailable…), `Spinner`, `Skeleton`/`TableSkeleton`, `EmptyState`, `ErrorState`, `Alert`, `Avatar` (picture from the API or initials), **`Modal`** (Esc to close, focus management — focus is set only when it *opens*), `ConfirmDialog`, `DataTable`, `Pagination`, `Tabs`.
* `toast.tsx` — toast provider (`aria-live`), `useToast()`.
* `shell.tsx` — `AppShell`: role guard (redirect if not signed in / wrong role), responsive sidebar (drawer on mobile), header with avatar, notification bell with unread polling for members, logout; `MEMBER_NAV` / `STAFF_NAV` with admin-only items filtered by role (**items a user cannot use are not shown**).
* `book.tsx` — `BookCover` (real cover or generated gradient), `Availability` badge, `BookCard`.
* `PictureUploader.tsx` — pick → client check (type/size) → **preview** → upload with **progress bar** → replace/remove with confirm dialog.
* `MemberFields.tsx` — address/contact fields shared by registration and staff member creation.
* `pickers.tsx` — `SearchInput`, `MemberPicker`, `BookPicker` (debounced type-ahead over the API).
* `LoanTable.tsx` — loans table with Renew (confirm dialog; server enforces policy).
* `BookForm.tsx` — add/edit book form (ISBN checksum validation, author/category multi-select, copies).
* `ResourcePage.tsx` — generic CRUD screen reused by categories, authors, publishers (search, paginate, modal form, admin-only delete that reports archive-vs-delete).

### 8.4 Layout groups and routes (`src/app`)
* `layout.tsx` — root: `AuthProvider`, `ToastProvider`, skip link. `globals.css`, `icon.svg`.
* **`(public)/layout.tsx`** — site header (menu: Browse, Categories, About, Contact, Log in / Join or the user's avatar) and footer (library name, opening hours, contact — read from `/settings/public`). Pages: `page.tsx` (home: search, categories, recently added, most borrowed), `books/page.tsx` (search, filters, sort, pagination, empty state, URL-synced), `books/[id]/page.tsx` (details, availability, reserve with confirm, favourite, reviews, related, print), `categories`, `about`, `contact`.
* **`(auth)/layout.tsx`** *(added in the last change)* — **focused layout for `/login`, `/register`, `/forgot-password`, `/reset-password`**: only the logo and a "Back to home" link, **no site menu and no footer** (the earlier version wrongly showed "Library / Opening hours / Contact" there). Pages: `login` (validated form, safe `?next=` redirect — only same-site paths), `register` (full form + membership type + **picture with preview and upload progress**, multipart), `forgot-password` (generic response, dev link when the server exposes it), `reset-password`.
* **`member/…`** (`layout.tsx` allows role member): `dashboard`, `loans` (+renew), `history`, `reservations` (queue position, ready banner, cancel), `fines` (balance, fines tab, payment history with receipt links), `notifications` (read/unread, mark all), `favorites`, `membership` (printable card, limits, history), `profile` (tabs: details form, picture, change password).
* **`staff/…`** (`layout.tsx` allows admin + librarian): `dashboard` (stat cards, recharts bar + line charts, recent activity, shortcuts, "needs attention"), `issue`, `return` (quick accession scan + open-loan search, condition: good/damaged/lost), `loans` (tabs active/overdue/closed/all), `reservations`, `members` (+register modal with optional picture) and `members/[id]` (picture, status actions with reasons, renew/change membership, loans/fines/reservations/history, edit, manual fine), `books` (+`new`, `[id]` with edit + physical copies + archive/delete, `import` CSV with dry-run and error table), `categories`, `authors`, `publishers`, `fines` (filters, add, waive), `payments` (record with unpaid-fine selection and confirm, history, admin reversal), `reviews` (moderation), `reports` (17 reports, filters, CSV).
* **`staff/admin/…`** — own `layout.tsx` redirecting non-admins: `staff`, `member-types`, `settings` (grouped, typed editors, dirty tracking), `audit`.
* `receipt/[id]/page.tsx` — standalone printable receipt (no app chrome), data from `/payments/:id`.

---

## 9. Root package, e2e, docs, env files

* **`package.json` (root)** — scripts to drive both apps: `install:all`, `dev` (API + web together via `concurrently`), `dev:api`, `dev:web`, `build`, `start`, `db:create|migrate|seed|setup`, `admin:create`, `test`, `lint`, `typecheck`, `e2e`.
* **`e2e/run.mjs`** (+ `package.json`, `avatar.png`) — puppeteer-core driving real Chrome through 25 steps: public pages, validation, registration with a picture (checks the decoded avatar is 64 px), picture replace/remove, profile edit, librarian login, role redirect, issue via UI, renew, **reserve → queue → return → "ready"**, fine → partial payment → receipt, notifications, admin dashboard/reports/settings/audit/types/staff, book creation, mobile layout (no horizontal overflow). Configurable with `WEB_URL`, `API_URL`, `DEMO_PASSWORD`, `CHROME_PATH`; expects a freshly seeded DB.
* **`docs/API.md`** (every endpoint + who may call it), **`docs/DATABASE.md`** (tables, integrity rules, locking, backup/restore), **`README.md`** (setup, commands, results, limitations), this guide.
* **Env files:** `.env.example` (root pointer), `backend/.env.example`, `frontend/.env.example`; real `.env` files are git-ignored.

---

## 10. Problems found and fixed (change log)

| # | Problem | Cause | Fix |
|---|---|---|---|
| 1 | Could not use MySQL | System MySQL needed credentials; AppArmor blocked a private instance under `$HOME` | Private `mysqld` in the scratch dir on 3307 meanwhile; moved to the user's MySQL on **3306** once authorised; dedicated `lms` app user created by `db:create`. |
| 2 | MySQL rejected the app password | Server password policy | Stronger dev password; note that `#` breaks unquoted dotenv values. |
| 3 | TypeScript 7 / Vitest 5 failed | Need newer Node than 20.11 | Pinned TS 5.9 and Vitest 2. |
| 4 | **Deadlock when creating books concurrently** | `DELETE FROM book_authors WHERE book_id=?` on an empty range took gap locks; two inserts then collided | `setLinks()` now diffs rows instead of delete-and-reinsert (documented in `DATABASE.md`). |
| 5 | Tests: "Cannot read properties of null (reading 'address')" | supertest created a server per request; nested requests closed each other | One shared listening server in `tests/helpers.ts`. |
| 6 | CORS test depended on local `.env` | `.env` origin changed to port 3100 | Origins pinned in `vitest.config.ts`. |
| 7 | `dist/` run could not find `.env` | path was relative to the source file | `.env` resolved from `process.cwd()`; `start` points to `dist/src/server.js`. |
| 8 | Port 3000 already used by another service | — | Frontend run on 3100; `FRONTEND_ORIGIN/APP_BASE_URL` updated; ports documented. |
| 9 | **Modal stole focus while typing** (found by e2e) | effect depended on `onClose`, so it re-ran on every render | Effect now depends only on `open`; latest `onClose` kept in a ref. |
| 10 | **Book form showed no authors** (found by e2e) | list endpoints were read as `{data:[…]}` after `api.get` had already unwrapped `data` | Read arrays directly; types tightened. |
| 11 | Next 16 deprecation | `middleware.ts` | Renamed to `proxy.ts` / `export function proxy`. |
| 12 | Lint rules | React-compiler purity rules flagged `Date.now()` in render | Moved into `useState` initialiser / helper functions. |
| 13 | Auth pages showed the public menu and footer | They lived in the `(public)` layout | New `(auth)` route group and layout (Part 8.4). |
| 14 | Needed one command for both apps | — | Root `package.json` with `concurrently`. |

---

## 11. How to run and verify

```bash
npm run install:all                       # root + backend + frontend
cp backend/.env.example backend/.env      # set DB_*, FRONTEND_ORIGIN (and DB_ADMIN_* for db:create)
npm run db:setup                          # create DB + migrate + seed (dev)   — or db:create / db:migrate only
npm run dev                               # API :4000 + web :3000 together
npm test                                  # 84 backend tests (rebuilds library_management_test)
npm run typecheck && npm run lint
npm run build
npm run e2e                               # needs both servers on a freshly seeded DB
```
First production admin: `ADMIN_EMAIL=you@example.org npm run admin:create`.
Verified behaviours: DB reads/writes through the API; pictures survive an API process restart byte-for-byte (served from MySQL); concurrency safety for issue, reservation and payment; role matrix; CSV export and import rules.

## 12. Known limitations
* No email/SMS provider (in-app notifications only; reset links are dev-only).
* No payment gateway; membership fees are informational.
* One role per user; overdue fines are created at return (UI shows today's estimate while overdue).
* In-memory rate limiter per process; proxy.ts only checks cookie presence; HTTPS/`COOKIE_SECURE` required in production.
* E2E on Chrome/Linux only; no load test or formal accessibility audit.
