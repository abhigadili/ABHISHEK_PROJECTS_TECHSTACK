# EMS-ExpressJS

Employee Management System — a **pure backend** REST API built with Node.js, Express 5 and MySQL 8.
No frontend, views, templates, CSS or static assets are included; use Postman, Bruno, curl or the bundled Swagger UI.

## Technology stack

| Concern | Choice |
|---|---|
| Runtime / framework | Node.js ≥ 18 (developed on 20.11), Express 5 |
| Database | MySQL 8.0.16+ via `mysql2` (parameterised queries only, no ORM) |
| Auth | Short-lived **JWT access token** (HS256, 15 min) + **rotating refresh tokens** (SHA-256 hashed in DB, reuse detection) |
| Passwords | `bcrypt` (12 rounds; 10–72 chars, upper/lower/digit/special) |
| Validation | `express-validator` |
| Security | `helmet`, `cors` (env allow-list), `express-rate-limit`, upload magic-byte sniffing, audit log |
| Uploads | `multer` (memory) → MySQL `LONGBLOB` |
| Tests | `jest` + `supertest` (isolated `*_test` database) |
| Docs | OpenAPI 3.0 via `swagger-ui-express` |

## Prerequisites

* Node.js ≥ 18 and npm
* MySQL 8.0.16+ and an account that can create databases/users **once** (for setup only)

## Installation

```bash
cd EMS-ExpressJS
npm install
cp .env.example .env        # then edit .env (see below)
```

## Environment variables (`.env`, never committed)

| Key | Purpose |
|---|---|
| `PORT`, `API_PREFIX` | Listen port (default 4100) and API prefix (`/api/v1`) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL connection for the app (**required**) |
| `TEST_DB_NAME` | Isolated test database; **must end in `_test`** |
| `JWT_ACCESS_SECRET` | ≥16 random chars (**required**); e.g. `openssl rand -hex 32` |
| `JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `BCRYPT_ROUNDS` | Token lifetimes / hashing cost |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed by CORS |
| `APP_TIMEZONE` | IANA zone used to decide the attendance "work date" (default `UTC`) |
| `LOGIN_RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX` | Per-15-minute limits |
| `FULL_DAY_HOURS` | Hours worked for a day to count as PRESENT instead of HALF_DAY (default 6) |
| `EXPOSE_RESET_TOKEN` | Dev only: return the password-reset token in the API response (ignored in production) |
| `MAX_UPLOAD_BYTES` | Upload size cap (default 2 MiB) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | Read only by `npm run admin:create` |

## MySQL database setup

1. As a privileged MySQL user create the database and an app user limited to it:
   ```sql
   CREATE DATABASE ems_expressjs CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE DATABASE ems_expressjs_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'ems'@'localhost' IDENTIFIED BY '<strong password>';
   GRANT ALL PRIVILEGES ON ems_expressjs.*      TO 'ems'@'localhost';
   GRANT ALL PRIVILEGES ON ems_expressjs_test.* TO 'ems'@'localhost';
   ```
2. Put those credentials in `.env`, then run `npm run db:init` (add `-- --no-sample` to skip sample employees).
   *Upgrading an existing database?* Run `npm run db:migrate` once — it idempotently adds `users.username` (unique) and `employees.gender`, needed by self-registration.

### SQL script execution order

`sql-scripts/` holds the full schema; see `sql-scripts/README.md` for MySQL-client and DBeaver instructions.

```
01_create_database.sql → 02_create_tables.sql → 03_create_indexes_and_constraints.sql → 04_create_views.sql
→ 07_seed_reference_data.sql → 08_seed_sample_employees.sql (optional, dev)
09_sample_queries_and_reports.sql and 10_database_validation_queries.sql are read-only helpers.
```

## Administrator initialization

No password lives in SQL or source. Create the first `SUPER_ADMIN` from the environment:

```bash
ADMIN_EMAIL=admin@company.example ADMIN_PASSWORD='S0me-Strong-Pass!' npm run admin:create
```
It refuses to run if a SUPER_ADMIN already exists and never prints the password. Further accounts are created with
`POST /api/v1/employees/{id}/account` (or an `account` object on employee creation); roles are changed by a SUPER_ADMIN via `PUT /employees/{id}/role`.

## Running

```bash
npm run dev      # nodemon, development
npm start        # NODE_ENV=production
npm test         # all tests (unit + integration), uses TEST_DB_NAME
npm run test:unit
npm run test:integration
npm run docs:openapi   # regenerates docs/api/openapi.json
```

* API base URL: `http://localhost:4100/api/v1`
* Swagger UI: `http://localhost:4100/api-docs` (raw spec: `/api-docs/openapi.json`)
* Health: `GET /health`

## Authentication & authorization

* `POST /auth/login` (`{email|username, password}`) → `{ accessToken, refreshToken, expiresIn }`. Send `Authorization: Bearer <accessToken>`.
* The JWT carries only `sub` (user id) and `role`. Every request re-loads the account, so deactivating a user takes effect immediately.
* `POST /auth/refresh` **rotates** the refresh token; replaying an already-rotated token revokes the whole token family.
  `POST /auth/logout` revokes the family; `logout-all`, password change and password reset revoke every session.
* Forgot/reset password: single-use, 30-minute tokens (hash stored). Core APIs need no SMTP; `utils/mailer.js` is the plug-in point.
* Login is rate-limited; forgot/reset/change/refresh have a tighter limiter.

| Role | Can |
|---|---|
| `SUPER_ADMIN` | Everything, incl. changing roles and creating other SUPER_ADMINs |
| `HR_ADMIN` | Employees (incl. salary), departments/teams/designations, attendance corrections, leave types/policies/adjustments, holidays, all reports, audit logs |
| `MANAGER` | Directory, own team's (whole subtree) attendance/leave/dashboard/reports, approve/reject leave of **direct reports** |
| `EMPLOYEE` | Own profile/attendance/leave/notifications, directory and org chart |

Field-level protection: salary/compensation is returned only to HR/SUPER_ADMIN and to the employee themself; personal email, DOB, address and
emergency contact only to HR and the employee; everyone else gets non-confidential directory fields. Write endpoints use an allow-list of
columns (mass-assignment guard), and the self-service profile accepts only phone/personal email/address/emergency-contact.

## API endpoint reference (all under `/api/v1`, Bearer auth except where noted)

| Area | Endpoints |
|---|---|
| **Auth** | `POST /auth/login` (email **or** username), `POST /auth/register` (public self-registration, multipart, role EMPLOYEE), `GET /auth/registration-options`, `GET /auth/username-available`, `POST /auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` (public) · `POST /auth/logout-all`, `/auth/change-password` · `GET /auth/me` |
| **Profile** | `GET/PATCH /profile` · `GET/PUT/DELETE /profile/picture` · `POST /profile/change-password` |
| **Employees** | `GET/POST /employees` · `GET/PUT/PATCH/DELETE /employees/{id}` · `POST /employees/{id}/deactivate\|reactivate\|account` · `PUT /employees/{id}/role` · `GET/POST /employees/{id}/job-history` · `GET/PUT/DELETE /employees/{id}/picture` |
| **Org chart** | `GET /org-chart` · `/org-chart/search` · `/org-chart/employees/{id}` · `/org-chart/employees/{id}/direct-reports` · `/org-chart/employees/{id}/reporting-chain` |
| **Departments** | `GET/POST /departments` · `GET/PUT/DELETE /departments/{id}` · `POST /departments/{id}/activate` |
| **Teams** | `GET/POST /teams` · `GET/PUT /teams/{id}` · `PUT /teams/{id}/members` |
| **Designations** | `GET/POST /designations` · `GET/PUT /designations/{id}` |
| **Attendance** | `POST /attendance/check-in\|check-out` · `GET /attendance/me\|summary` · `GET /attendance/reports/monthly\|department` · `GET/POST /attendance` · `GET/PUT /attendance/{id}` |
| **Leave** | `GET/POST /leave/types` · `PUT /leave/types/{id}` · `GET /leave/balances` · `GET /leave/balances/employees/{id}` · `POST /leave/balances/adjust` · `GET /leave/history[/employees/{id}]` · `POST/GET /leave/requests` · `GET /leave/requests/me\|pending-approvals\|{id}` · `POST /leave/requests/{id}/approve\|reject\|cancel\|documents` · `GET /leave/requests/{id}/documents/{docId}` · `GET /leave/team` |
| **Holidays/calendar** | `GET/POST /holidays` · `PUT/DELETE /holidays/{id}` · `GET/PUT /weekly-offs` · `GET /calendar/leave\|attendance` |
| **Dashboard/reports** | `GET /dashboard` · `/upcoming-events` · `/reports/joiners-exits\|leave-balances\|leave-summary\|departments\|designations` (`?format=csv` for CSV) |
| **Notifications** | `GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/read` · `GET /notifications/{id}` · `POST /notifications/{id}/read` |
| **Audit** | `GET /audit-logs` (HR/SUPER_ADMIN) |

Lists accept `page`, `limit` (≤100) and `sort=field[:desc]` (whitelisted). `GET /employees` supports `q`, `departmentId`, `teamId`,
`designationId`, `managerId`, `status` (default `ACTIVE`; `ALL` for HR), `employmentType`.
Full request/response schemas: Swagger UI.

## Error-response format

Success: `{ "success": true, "message": "...", "data": ..., "meta": { "page", "limit", "total", "totalPages" } }`

Error:
```json
{ "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
             "details": [ { "field": "workEmail", "message": "workEmail must be a valid email", "location": "body" } ],
             "requestId": "5f0c…" } }
```
Stable codes include `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_EMAIL`, `DUPLICATE`,
`CIRCULAR_REPORTING`, `OVERLAPPING_LEAVE`, `INSUFFICIENT_BALANCE`, `ALREADY_PROCESSED`, `ALREADY_CHECKED_IN`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`,
`RATE_LIMITED`, `INTERNAL_ERROR`. Stack traces, SQL errors and secrets are never returned; the `requestId` (also in `X-Request-Id`) correlates with server logs.

## Database architecture

Tables (21 + 2 views): `roles`, `users`, `employees`, `employee_profile_pictures`, `departments`, `teams`, `designations`, `job_history`, `attendance`,
`leave_types`, `leave_policies`, `leave_balances`, `leave_requests`, `leave_request_documents`, `leave_balance_transactions`, `holidays`, `weekly_offs`,
`notifications`, `password_reset_tokens`, `refresh_tokens`, `audit_logs`.

* **Account vs person:** `users.employee_id` → `employees.id` (UNIQUE, nullable). All HR data lives on `employees`; `users` holds only credentials/role/active flag.
* **Org hierarchy:** `employees.manager_id` self-FK; trees are generated with recursive CTEs (cycle-guarded, depth ≤ 25).
* **Leave integrity:** `leave_balances (employee, type, year)` unique; every movement is a row in `leave_balance_transactions`, unique on `(leave_request_id, type)`,
  so a balance can never be deducted twice for one request. Available = `entitled + adjusted − used`, with a CHECK ≥ 0.
* **Attendance:** unique `(employee_id, work_date)`; check-out ≥ check-in CHECK.
* Salaries/profile pictures are in separate columns/tables so listing queries never touch them.

More: `docs/architecture/` (design notes, and `202610161304_request-flow-guide.md` — what happens, layer by layer, for every endpoint), `docs/api/openapi.json`.

## Business rules worth knowing

* **Leave day counting:** weekly-off days (configurable per location, default Sat/Sun) and non-optional holidays (global `ALL` or the employee's work location) are **not** counted.
  A half-day (`FIRST_HALF`/`SECOND_HALF`) is a single working day and counts 0.5; two opposite halves on the same day may coexist. A request must lie within one calendar year and cannot be back-dated > 30 days.
* **Unpaid leave** has no policy/balance: it is validated for overlaps and dates but never deducted.
* **Balances** are created lazily per year from policy (with carry-forward up to `carry_forward_max`). Pending requests are reserved against availability at apply time; the deduction happens, in one transaction with row locks, at approval. Cancelling an approved request refunds exactly once.
* **Approval authority:** HR/SUPER_ADMIN, or the requester's direct manager with a MANAGER role; nobody decides their own request.
* **Attendance:** server clock only; the work date is derived in `APP_TIMEZONE`; hours are computed on check-out. No record is ever auto-created as "absent".

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing/invalid environment configuration` | Fill `DB_USER`, `DB_PASSWORD`, `JWT_ACCESS_SECRET` in `.env` |
| `ER_ACCESS_DENIED_ERROR` | Wrong DB credentials, or the app user lacks rights on `ems_expressjs` |
| `Your password does not satisfy the current policy` (MySQL) | Use a longer mixed-case password with digits/symbols for the MySQL user |
| `ER_TABLEACCESS_DENIED`/`SUPER privilege` | Triggers are deliberately not used; if you add any, binary logging needs SUPER or `log_bin_trust_function_creators=1` |
| `.env` values with `#` truncated | Quote them: `DB_PASSWORD="abc#123"` |
| Port in use | Change `PORT` |
| Tests refuse to start | `TEST_DB_NAME` must exist and end with `_test` (tests drop and recreate its tables) |
| 429 responses | Rate limit hit; wait or raise `*_RATE_LIMIT_MAX` |
