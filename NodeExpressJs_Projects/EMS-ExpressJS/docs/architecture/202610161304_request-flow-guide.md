# EMS-ExpressJS — Request flow guide

*"If I hit this endpoint, where does the request go first, and what happens next?"* This guide answers that for **all 99 routes**.
Part 1 is the journey every request takes. Part 2 explains the building blocks you will see named in every flow. Part 3 walks through each endpoint.

---

## Part 1 — The journey every request takes

```
Client
  │  HTTP request  e.g. POST /api/v1/leave/requests
  ▼
┌─ src/server.js ──────────────────────────────────────────────────────────────┐
│ starts Express (createApp) on PORT, starts the token-cleanup job             │
└──────────────────────────────────────────────────────────────────────────────┘
  ▼
┌─ src/app.js : global middleware, in this exact order ────────────────────────┐
│ 1. requestId        → assigns a UUID, sets X-Request-Id response header      │
│ 2. /api-docs        → Swagger UI (mounted BEFORE helmet so its scripts load) │
│ 3. helmet           → security headers                                       │
│ 4. cors             → allows only origins in CORS_ALLOWED_ORIGINS            │
│ 5. express.json     → parses JSON body (max 100 kb); bad JSON → 400          │
│ 6. query pin        → copies req.query to a normal object (Express 5 quirk,  │
│                       lets toInt()/toBoolean() results stick)                │
│ 7. request logger   → logs method/path/status/ms when the response finishes  │
│ 8. GET /health      → answers directly (SELECT 1); never goes further        │
│ 9. api rate limiter → 300 req / 15 min per IP, applied to /api/v1/*          │
└──────────────────────────────────────────────────────────────────────────────┘
  ▼
┌─ src/routes/index.js ────────────────────────────────────────────────────────┐
│ /auth/*  → authRoutes   (PUBLIC, except logout-all / me / change-password)   │
│ ── router.use(authenticate) ── everything below needs a valid access token ──│
│ /profile        → profileRoutes                                              │
│ /employees      → employeeRoutes                                             │
│ /org-chart      → orgRoutes                                                  │
│ /attendance     → attendanceRoutes                                           │
│ /leave          → leaveRoutes                                                │
│ /notifications  → notificationRoutes                                         │
│ /audit-logs     → authorize(SUPER_ADMIN, HR_ADMIN) → auditRoutes             │
│ /               → referenceRoutes  (departments, teams, designations)        │
│ /               → holidayRoutes    (holidays, weekly-offs, calendar/*)       │
│ /               → reportRoutes     (dashboard, upcoming-events, reports/*)   │
└──────────────────────────────────────────────────────────────────────────────┘
  ▼
┌─ inside the matched route file ──────────────────────────────────────────────┐
│ [route limiter] → [authorize(roles)] → [validators] → validate → [upload]    │
│                 → controller                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
  ▼
controller  →  service  →  repository  →  MySQL      (then back up the same chain)
  ▼
response envelope  { success, message, data, meta? }
  ▼  (if anything threw at ANY step)
notFound (unknown route) / errorHandler  →  { success:false, error:{ code, message, details?, requestId } }
```

### The order inside a route is deliberate

| Step | Why it is in this position |
|---|---|
| `authenticate` (applied once, in `routes/index.js`) | Reject anonymous callers before doing any other work |
| `authorize(roles)` | Reject the wrong role **before** parsing/validating, so a forbidden caller learns nothing about the payload rules |
| validators + `validate` | Bad input stops here with `400 VALIDATION_ERROR`; controllers/services can trust types |
| `imageUpload` / `documentUpload` | Runs after authz/validation so unauthorised callers can't make the server buffer files |
| controller | Only HTTP: reads `req.params/query/body/user`, calls a service, writes the response, records audit entries |
| service | Business rules, ownership checks, transactions, notifications |
| repository | Only SQL (parameterised `?` placeholders); no business logic |

### Short-circuit points (where a request can end early)

| Where | Result |
|---|---|
| `express.json` | `400 MALFORMED_JSON` / `413 PAYLOAD_TOO_LARGE` |
| rate limiters | `429 RATE_LIMITED` |
| `authenticate` | `401 UNAUTHORIZED` / `INVALID_TOKEN` (bad or expired token) / `ACCOUNT_DISABLED` |
| `authorize` | `403 FORBIDDEN` |
| `validate` | `400 VALIDATION_ERROR` with `details:[{field,message}]` |
| upload middleware | `400 FILE_REQUIRED` / `INVALID_FILE_TYPE`, `413 FILE_TOO_LARGE` |
| service rules | `404`, `409`, `422` with a specific `code` (e.g. `OVERLAPPING_LEAVE`) |
| no route matches | `404 NOT_FOUND` (JSON) |
| unexpected error | `500 INTERNAL_ERROR` — message is generic; the real error is only in the server log, matched by `requestId` |

---

## Part 2 — Building blocks referenced in every flow

### `authenticate` (src/middleware/auth.js)
1. Read `Authorization: Bearer <token>`; missing → 401.
2. `jwt.verify` (HS256, secret from `.env`). Expired/forged → 401.
3. `userRepository.findAuthContext(sub)` — **a DB read on every request** (`users ⨝ roles`), so a deactivated user is locked out instantly.
4. Sets `req.user = { id, employeeId, role, email }`.

### `authorize(...roles)`
Checks `req.user.role` against the list. Shorthand used below: **ADMINS** = SUPER_ADMIN + HR_ADMIN, **MANAGERS_UP** = ADMINS + MANAGER, **ALL** = any logged-in role.

### `accessScope` (src/services/accessScope.js) — "whose data may I see?"
`visibleEmployeeIds(user)` returns `null` (admins → no restriction), **self + every report in the subtree** (MANAGER, via recursive CTE), or **[self]** (EMPLOYEE). Attendance, leave, dashboard, reports and calendars all filter by it. `assertCanSee(user, employeeId)` throws `403` when the target is outside that set.

### `employeeMapper.toEmployee(row, viewer)` — "which fields do I get back?"
Admin → everything + compensation + account. Self → personal data + own compensation. Anyone else → directory fields only (no salary, DOB, personal email, address).

### `withTransaction(fn)` (src/config/database.js)
Gets a connection, `BEGIN`, runs `fn(conn)`, `COMMIT` — or `ROLLBACK` on any throw. Every multi-step write below runs inside one. Reads that must see the result are done **after** the commit.

### `notificationService` / `auditService`
`notify*` inserts rows into `notifications` (best-effort, never fails the request). `audit.log` inserts into `audit_logs` (never throws). Controllers call audit **after** the service succeeded.

### Reading the flow tables below
`Route chain` lists what runs between `authenticate` and the controller. `→` separates layers. `[tx]` = inside a transaction. Table names in `code` are what is read/written. "Fails with" lists the notable error codes.

---

## Part 3 — Endpoint flows

> All paths are relative to `/api/v1`. "Global" = Part 1 steps 1–9 have already run.

### 3.1 Authentication — `routes/authRoutes.js` → `authController` → `authService`

#### `POST /auth/login` (public)
1. Global → api limiter → **login limiter** (10 / 15 min / IP) → `v.login` (valid email, non-empty password) → `validate`.
2. `authController.login` → `authService.login(email, password)`.
3. `userRepository.findByEmail` (lower-cased email; `users ⨝ roles`).
4. `bcrypt.compare` against the stored hash — **or against a dummy hash when the email doesn't exist**, so timing doesn't reveal which emails are real.
5. Wrong password / unknown email / `is_active = 0` → the same `401 INVALID_CREDENTIALS`.
6. `userRepository.touchLogin` → `users.last_login_at`.
7. `issueTokens`: sign a JWT containing only `{ sub, role }` (15 min); generate a random refresh token, store **only its SHA-256** in `refresh_tokens` with a new `family_id` (7 days).
8. Controller writes audit `LOGIN` → `audit_logs`, returns `{ accessToken, refreshToken, tokenType, expiresIn, user }`.

#### `POST /auth/refresh` (public)
1. Global → api limiter → **sensitive limiter** (20 / 15 min) → validators.
2. `authService.refresh` **[tx]**: `findRefreshByHash` with `FOR UPDATE` (row lock).
3. Unknown token → `401 INVALID_REFRESH_TOKEN`.
4. Token already revoked → someone is replaying an old token: **revoke the whole family** (committed on purpose), `401 REFRESH_TOKEN_REUSED`.
5. Expired → `401 REFRESH_TOKEN_EXPIRED`. User gone/disabled → `401 ACCOUNT_DISABLED`.
6. Issue a new access + refresh token **in the same family**; atomically revoke the old one (`UPDATE … WHERE revoked_at IS NULL`, `replaced_by` = new id). If two parallel calls race, only one `affectedRows = 1` wins; the other gets `REFRESH_TOKEN_REUSED`.

#### `POST /auth/logout` (public — you only need the refresh token)
Validators → `authService.logout`: look up the token hash → `revokeFamily` (all tokens of that login chain). Always `200`, even if the token was unknown.

#### `POST /auth/logout-all`
`authenticate` → controller → `tokenRepo.revokeAllForUser(req.user.id)` — every refresh token the user owns is revoked.

#### `GET /auth/me`
`authenticate` → `authService.me`: `userRepository.findById` + `employeeRepository.findBrief(employee_id)` → `{ id, email, role, lastLoginAt, employee:{…} }`.

#### `POST /auth/forgot-password` (public)
1. sensitive limiter → validators.
2. `authService.forgotPassword`: find user. **If not found/inactive it still returns the same generic message** (no account enumeration).
3. If found **[tx]**: `invalidateResets` (kill older tokens) → `insertReset` (`password_reset_tokens`: SHA-256 of a random token, expires in 30 min).
4. `mailer.sendMail` — no SMTP in core, so it only logs "skipped". If `EXPOSE_RESET_TOKEN=true` (never in production) the token is returned in `data.resetToken`; otherwise it is never exposed.

#### `POST /auth/reset-password` (public)
sensitive limiter → validators (token + strong `newPassword`) → `authService.resetPassword` **[tx]**: `claimReset` (`SELECT … FOR UPDATE` an unused, unexpired token, then mark `used_at`) → none found → `400 INVALID_RESET_TOKEN` → `updatePassword` (bcrypt) → `revokeAllForUser` (logs out every device) → `invalidateResets`. A second use of the same token fails because it is already marked used.

#### `POST /auth/change-password`
`authenticate` → sensitive limiter → validators → `authService.changePassword`: load user, bcrypt-verify `currentPassword` (`400 WRONG_PASSWORD`), reject same password (`PASSWORD_REUSE`) → **[tx]** `updatePassword` + `revokeAllForUser` → controller audits `PASSWORD_CHANGE`. The caller must log in again.

---

### 3.2 Profile (self-service) — `routes/profileRoutes.js` → `employeeController` → `employeeService`
Everything here acts on **the caller's own** `req.user.employeeId`; no id in the URL, so nobody can target someone else. If the account has no linked employee → `404`.

| Endpoint | Flow |
|---|---|
| `GET /profile` | `authenticate` → `svc.profile` → `employeeRepository.findById` (joins `employees` + `departments` + `designations` + `teams` + manager + `employee_profile_pictures` + `users/roles`) → `toEmployee` in **self** tier (includes own salary, DOB, address) |
| `PATCH /profile` | `v.profile` first runs a **custom allow-list**: any key other than `personalEmail, phone, addressLine, city, state, country, postalCode, emergencyContact{Name,Phone,Relation}` → `400` (so `salary`, `managerId`, `role`, `status` can never be self-set) → `svc.updateProfile` → `employeeRepository.update` → re-read via `getById` |
| `GET /profile/picture` | `svc.getPicture(myId)` → `findBrief` + `employee_profile_pictures` → bytes streamed with the stored `Content-Type`, `nosniff`, `private` cache. `404` if none |
| `PUT /profile/picture` | **`imageUpload`**: multer reads field `file` into memory (limit `MAX_UPLOAD_BYTES`; bigger → `413`) → **magic-byte sniff** (JPEG/PNG/WebP) → must match the declared MIME or `400 INVALID_FILE_TYPE` → `svc.putPicture` → upsert into `employee_profile_pictures` (`LONGBLOB`) |
| `DELETE /profile/picture` | `svc.removePicture` → `DELETE` row; `404` if none |
| `POST /profile/change-password` | Same as `/auth/change-password` (reuses `authController.change`) |

---

### 3.3 Employees — `routes/employeeRoutes.js` → `employeeController` → `employeeService` → `employeeRepository` (+ `referenceRepository`, `userRepository`, `orgRepository`)

#### `GET /employees` (ALL)
1. `v.list` (page/limit ≤ 100, filters typed, `sort` string) → `validate`.
2. `controller.list` → `parsePagination`.
3. `svc.list`: `parseSort` maps `sort=name:desc` through a **whitelist** (anything else → default order; no SQL injection). `status` defaults to `ACTIVE`; non-admins are forced to `ACTIVE`.
4. `repo.search`: builds `WHERE` from `q` (name/email/code/title, `%`/`_` escaped), `departmentId`, `teamId`, `designationId`, `managerId`, `employmentType`, `status` → one `COUNT(*)` + one page query.
5. Each row → `toEmployee(row, viewer)` (field-level security) → `paged()` envelope with `meta`.

#### `POST /employees` (ADMINS)
1. `authorize(ADMINS)` → `v.create` (names, email, dates, FK ints, salary, optional `account{role,password}` with password policy) → `validate`.
2. `svc.create`: lower-case emails; pick **only whitelisted columns** (unknown keys ignored); `ensureEmailFree` (`409 DUPLICATE_EMAIL`); only a SUPER_ADMIN may create a SUPER_ADMIN account; hash the account password (bcrypt) **before** opening the transaction.
3. **[tx]** `validateRelations` (department active? designation active? team active **and** inside that department? manager active?) → `422 INVALID_*`.
4. Generate `employee_code` (`EMP-<max+1>`) if not supplied → `INSERT employees` (DB unique keys on code and work email are the last line of defence → `409 DUPLICATE`).
5. `INSERT job_history` (`JOINED`). If `account` given → `INSERT users` (linked by `employee_id`).
6. Notify the manager and the new employee (`ONBOARDING`) → `notifications`. Commit.
7. Controller audits `EMPLOYEE_CREATE`, then reads the employee **after commit** → `201`.

#### `GET /employees/:id` (ALL)
`v.id` → `svc.getById` → `findById` (`404` if missing) → `toEmployee` for the viewer: HR sees compensation + account; the employee sees their own full record; anyone else gets directory fields only.

#### `PUT /employees/:id` and `PATCH /employees/:id` (ADMINS) — identical flow
1. `authorize(ADMINS)` → `v.update` → `svc.update`: whitelist columns (so `id`, `employeeCode`, `status` in the body are ignored); email uniqueness excluding self.
2. **[tx]** `lockById … FOR UPDATE` (`404` if missing).
3. If the department changed and no team was sent, the team is cleared. `validateRelations` runs again, plus **cycle checks** for `managerId`: self → `422 SELF_REPORTING`; new manager is a descendant (`orgRepository.ancestorIds` contains this employee) → `422 CIRCULAR_REPORTING`.
4. Diff old vs new; nothing changed → no-op. Otherwise `UPDATE employees`.
5. If department / manager / designation / job title changed → `INSERT job_history` (`TRANSFER`, `MANAGER_CHANGE` or `JOB_CHANGE`, or your explicit `changeType` such as `PROMOTION`; from→to values and `effectiveDate`/`notes`). Manager or department changes also notify the employee and new manager (`ORG_CHANGE`).
6. Work-email change also updates `users.email`. Commit → controller audits `EMPLOYEE_UPDATE` → re-read after commit.

#### `DELETE /employees/:id` and `POST /employees/:id/deactivate` (ADMINS) — soft delete
`v.deactivate` → `svc.deactivate` **[tx]**: lock row → already inactive `409` → cannot deactivate yourself (`422`) → count active direct reports: if any and no `reassignReportsTo` → `409 HAS_ACTIVE_REPORTS`; if given, validate the target (active; if it sits below the leaver it is re-parented first to avoid a cycle) and move the reports → set `status=INACTIVE`, `exit_date` → `job_history STATUS_CHANGE` → `users.is_active=0` and **revoke all refresh tokens** → clear them as department head. Attendance/leave history is untouched (soft delete). Audit `EMPLOYEE_DEACTIVATE`.

#### `POST /employees/:id/reactivate` (ADMINS)
`svc.reactivate` **[tx]**: must currently be inactive (`409 ALREADY_ACTIVE`) → status `ACTIVE`, clear `exit_date`; if the old manager is no longer active the manager link is cleared → history entry → `users.is_active=1`.

#### `GET /employees/:id/job-history` (ALL, restricted in service)
`svc.history`: `404` if the employee doesn't exist → `canViewDetail`: **HR/SUPER_ADMIN, the employee themself, or a MANAGER who is above them in the chain** (`orgRepository.ancestorIds`), else `403` → `employeeRepository.listHistory` (joins designations/departments/managers for readable from→to).

#### `POST /employees/:id/job-history` (ADMINS)
Validate (`changeType` enum, `effectiveDate`) → `svc.addHistory` → `INSERT job_history` → audit `JOB_HISTORY_ADD` → returns the updated list. (Use this for promotions/probation events that don't change a column.)

#### `POST /employees/:id/account` (ADMINS)
`v.account` (role + strong password) → `svc.createAccount`: `404` no employee; `409 ACCOUNT_EXISTS`; only SUPER_ADMIN can grant SUPER_ADMIN → `INSERT users` (login email = employee work email) → audit `ACCOUNT_CREATE`.

#### `PUT /employees/:id/role` (SUPER_ADMIN only)
`authorize(SUPER_ADMIN)` → `svc.setRole`: employee must have an account (`404`); you cannot change **your own** role (`422`) → `users.role_id` → audit `ROLE_CHANGE`.

#### `GET /employees/:id/picture` (ALL)
`svc.getPicture(id, viewer)`: `404` unknown employee; **inactive employees' pictures are visible only to HR or the employee**; `404` if none → stream bytes (`Content-Type` from DB, `nosniff`, `private` cache).

#### `PUT /employees/:id/picture` (ADMINS) and `DELETE /employees/:id/picture` (ADMINS)
Same as the profile picture flow (authorize → validate → `imageUpload` → upsert/delete in `employee_profile_pictures`), but targeting `:id`.

---

### 3.4 Organization chart — `routes/orgRoutes.js` → `orgController` → `orgService` → `orgRepository` (all roles, read-only)
The chart is **always generated from `employees.manager_id` at request time** with MySQL recursive CTEs — nothing is stored or hardcoded.
Every CTE carries a `path` string (`,1,4,9,`) and only expands a row if its id is **not already in the path**, and stops at depth 25. That is what makes corrupt legacy data (A→B→A) harmless.

| Endpoint | Flow |
|---|---|
| `GET /org-chart?depth=&departmentId=` | validators → `orgService.hierarchy` → `orgRepository.treeRows` seeds from **roots** (no manager, or manager not active) and walks down through active employees → `assemble()` turns the flat depth-ordered rows into nested `{ …node, directReportCount, subordinates:[…] }` → if `departmentId` is given, prune branches that contain nobody from that department (ancestors needed to connect them are kept) → finally compares against all active employees: anyone no root can reach (e.g. a cycle) is returned in `data.warnings.unreachableEmployees` instead of looping |
| `GET /org-chart/employees/:id` | same, seeded at that employee (`404` if missing) — the subtree retrieval for big organisations |
| `GET /org-chart/employees/:id/direct-reports` | `orgRepository.directReports` (active employees whose `manager_id = :id`, with their own report counts) |
| `GET /org-chart/employees/:id/reporting-chain` | `orgRepository.ancestorIds` (upward CTE) → `nodesByIds` → ordered `chain:[{level:1…n}]` (nearest manager first) |
| `GET /org-chart/search?q=&rootId=` | candidate ids = the subtree under `rootId`, or all active employees → `searchInTree` (LIKE on name/code/title, wildcards escaped, max 50) → for each hit, its `managerChainIds` |

How the **cycle prevention on writes** ties in: `PUT /employees/:id` with a `managerId` calls `ancestorIds(newManager)`; if the employee being edited appears in that list the change is refused (`CIRCULAR_REPORTING`), and `managerId == id` is refused (`SELF_REPORTING`).

---

### 3.5 Departments, teams, designations — `routes/referenceRoutes.js` → `referenceController` → `referenceService` → `referenceRepository`
Reads are open to ALL roles; writes need **ADMINS**. List endpoints share `listOf()` in the controller: `parsePagination` → service → repository (`COUNT` + page, `q` LIKE with escaping, optional `isActive`/`departmentId`) → `paged()`.

#### Departments
| Endpoint | Flow |
|---|---|
| `GET /departments` | list + search (`q` on name/code) + `isActive`; each row includes head name and **live active headcount** |
| `POST /departments` (ADMINS) | `v.deptCreate` (code `A-Z0-9_-`, name) → `validateHead` if `headEmployeeId` (must be an active employee; the same-department rule is only enforced on update, since the new department has no members yet) → `INSERT departments` (`409` on duplicate code/name) → audit `DEPARTMENT_CREATE` |
| `GET /departments/:id` | `getDepartmentDetail` (`404`) |
| `PUT /departments/:id` (ADMINS) | `404` check → if `headEmployeeId` present: active + member of this department else `422 INVALID_HEAD` → dynamic `UPDATE` of only the supplied columns → audit `DEPARTMENT_UPDATE` |
| `DELETE /departments/:id` (ADMINS) | **deactivate, never delete**: refuses with `409 DEPARTMENT_NOT_EMPTY` while it has active employees; otherwise `is_active=0` and head cleared → audit `DEPARTMENT_DEACTIVATE` |
| `POST /departments/:id/activate` (ADMINS) | `is_active=1` |

#### Teams
| Endpoint | Flow |
|---|---|
| `GET /teams` | filters `q`, `departmentId`, `isActive`; includes department name and member count |
| `POST /teams` (ADMINS) | department must exist and be active (`422 INVALID_DEPARTMENT`) → `INSERT teams` (unique per department+name → `409`) → returns team with members |
| `GET /teams/:id` | team + active members |
| `PUT /teams/:id` (ADMINS) | update name/description/lead/`isActive` |
| `PUT /teams/:id/members` (ADMINS) | body `employeeIds[]` → team must be active → **[tx]** load those employees: any missing → `422 INVALID_EMPLOYEE`; any in a different department → `422 TEAM_DEPARTMENT_MISMATCH` → `UPDATE employees SET team_id` |

#### Designations
`GET /designations`, `GET /designations/:id` (ALL) · `POST` / `PUT /designations/:id` (ADMINS): `v.desCreate/desUpdate` (name, description, `jobLevel` 1–20, `isActive`) → insert/dynamic update → `409` on duplicate name. Employees can only be assigned **active** designations (checked in `validateRelations`).

---

### 3.6 Attendance — `routes/attendanceRoutes.js` → `attendanceController` → `attendanceService` → `attendanceRepository`
**Route order matters:** fixed paths (`/check-in`, `/me`, `/summary`, `/reports/*`) are declared **before** `/:id` so they aren't mistaken for an id.
The server's clock decides everything; the "work date" is *today in `APP_TIMEZONE`*; any `checkInAt`/`workDate` a client sends to check-in/out is ignored.

#### `POST /attendance/check-in` (ALL)
1. `v.checkIn` (`workMode` enum, `remarks`) → `svc.checkIn`.
2. Caller must be linked to an employee (`422 NO_EMPLOYEE_RECORD`) and be `ACTIVE` (`403`).
3. **[tx]** `findByEmployeeDate … FOR UPDATE` on (employee, today): already has a check-in → `409 ALREADY_CHECKED_IN`. A marker row without check-in (e.g. HR pre-created) is updated; otherwise `INSERT attendance` (status `PRESENT`).
4. The DB unique key `(employee_id, work_date)` guarantees a race between simultaneous check-ins still yields exactly one row.

#### `POST /attendance/check-out` (ALL)
`svc.checkOut` **[tx]**: lock today's row → none/no check-in → `409 NOT_CHECKED_IN`; already out → `409 ALREADY_CHECKED_OUT` → compute hours = now − check-in (2 decimals) → status `PRESENT` if hours ≥ `FULL_DAY_HOURS`, otherwise `HALF_DAY` (a short day is **never** auto-marked absent) → update row.

#### `GET /attendance/me` (ALL)
`v.list` → `svc.mine` → `attendanceRepository.list` for `[my employee id]` with `from/to/status`, paginated, or `?format=csv` (no paging, `sendCsv`).

#### `GET /attendance` (ALL, scoped)
`svc.listFor`: ids = `accessScope.visibleEmployeeIds` (HR: all; manager: self + subtree; employee: self). If `employeeId` is passed it must be inside that scope else `403`. Filters `from/to/status/departmentId`; `?format=csv` supported.

#### `GET /attendance/:id` (ALL, scoped)
`svc.getById` → `404` → `accessScope.assertCanSee(record.employeeId)` → `403` for strangers.

#### `GET /attendance/summary` (ALL, scoped)
Counts per status + total hours for `from/to` (default: current month) over the scoped employees; optional `employeeId` (scope-checked).

#### `POST /attendance` (ADMINS) — HR manual entry
`v.manual` (employee, date, optional times, `reason` required) → `svc.createManual`: employee must exist; `buildCorrection` validates order (`422 INVALID_ORDER`), computes hours/status → **[tx]** duplicate day → `409 DUPLICATE_ATTENDANCE` → insert + stamp `corrected_by/at/reason` → notify employee (`ATTENDANCE_CORRECTED`) → audit `ATTENDANCE_MANUAL`.

#### `PUT /attendance/:id` (ADMINS) — correction
`v.correct` (**`reason` mandatory**) → `svc.correct` **[tx]**: load row (`404`) → merge new times over old, validate (check-out needs a check-in; out ≥ in), recompute hours/status → `UPDATE` + `corrected_by`, `corrected_at`, `correction_reason` (audit trail on the row) → notify the employee → controller also writes `audit_logs ATTENDANCE_CORRECT`.

#### `GET /attendance/reports/monthly` (MANAGERS_UP) · `GET /attendance/reports/department` (ADMINS)
Monthly: `year` + `month` required → `monthRange` → one aggregate query over scoped active employees (present/half-day/absent/on-leave/holiday/weekly-off counts, total hours). Department-wise: per department for `from/to` (default current month). Both accept `?format=csv`.

---

### 3.7 Leave — `routes/leaveRoutes.js` → `leaveController` → `leaveService` → `leaveRepository` (+ `holidayRepository`, `employeeRepository`, `notificationService`)

#### How a day count is computed (used by apply and approve) — `leaveService.computeDays`
1. Weekly-off days for the employee's work location (location rows override the `ALL` rows) via `holidayRepository.effectiveWeeklyOffDays`.
2. Non-optional holidays in the range (`ALL` or that location) via `holidayDates`.
3. Count the remaining dates. None left → `422 NO_WORKING_DAYS`. A half-day request is exactly **0.5**.

#### `POST /leave/requests` (ALL) — apply
1. `v.apply` → `svc.apply`. Cheap checks first: end ≥ start; half-day must be a single day; **not spanning two calendar years**; not back-dated > 30 days (`422`).
2. **[tx]** `employeeRepository.lockById` — locks *this employee's* row, so their concurrent applications queue up and the overlap check can't race.
3. Employee active; leave type exists + active; half-day allowed by policy; `computeDays`; `maxConsecutiveDays` policy (`MAX_CONSECUTIVE_EXCEEDED`).
4. **Overlap check** against their `PENDING`/`APPROVED` requests (`409 OVERLAPPING_LEAVE`); the one exception: two *opposite* half-days on the same day.
5. If the type has a policy (not unpaid): `ensureBalances(year)` creates missing balance rows from policy (+ carry-forward) and writes the `ENTITLEMENT` ledger rows → `lockBalance … FOR UPDATE` → available = entitled + adjusted − used − **pending days** → too low → `422 INSUFFICIENT_BALANCE {available, requested}`.
6. `INSERT leave_requests` (`PENDING`). Notify the direct manager (`LEAVE_APPLIED`) — or all HR_ADMINs when the employee has no manager. Commit → return the request.
Nothing is deducted yet — only *reserved* through the pending-days term.

#### `POST /leave/requests/:id/approve` and `POST /leave/requests/:id/reject` (MANAGERS_UP)
1. `authorize(MANAGERS_UP)` → `v.decide` → `svc.decide(id, user, {action, note})`.
2. **[tx]** `findRaw` locks the request row. `404` if missing.
3. `assertCanDecide`: never your own request (`403`); allowed if HR/SUPER_ADMIN, or a MANAGER whose employee id equals the requester's `manager_id`; anyone else `403`.
4. Status must still be `PENDING`, otherwise `409 ALREADY_PROCESSED` (this is what stops double approval / double deduction).
5. **Approve only:** if the type `requiresDocument` and none attached → `422 DOCUMENT_REQUIRED`. With a policy: `ensureBalances` → `lockBalance` → re-check availability → `INSERT leave_balance_transactions (DEDUCTION, −days)` — the unique key `(leave_request_id, type)` makes a second deduction **impossible even if code were bypassed** → `leave_balances.used += days`. For full-day leave, `INSERT IGNORE attendance … ON_LEAVE` for each working day.
6. Set `status`, `decided_by`, `decided_at`, `decision_note`. Notify the employee (`LEAVE_APPROVED`/`LEAVE_REJECTED`). Commit. Controller audits `LEAVE_APPROVE`/`LEAVE_REJECT`.
Reject takes steps 1–4 and 6 only: balance untouched.

#### `POST /leave/requests/:id/cancel` (ALL) — cancel/withdraw
`svc.cancel` **[tx]**: lock request → only the requester or HR (`403`) → only `PENDING`/`APPROVED` (`409`). **Pending:** just mark `CANCELLED`. **Approved:** an employee may cancel only before the start date (`422 LEAVE_STARTED`; HR any time) → `INSERT … REFUND (+days)` in the ledger (unique per request, so exactly one refund), `used −= days`, delete that request's `ON_LEAVE` attendance rows that have no check-in → mark `CANCELLED`, notify the manager (and the employee if HR cancelled) → audit `LEAVE_CANCEL`.

#### `GET /leave/requests` (ALL, scoped) · `GET /leave/requests/me` (ALL) · `GET /leave/requests/pending-approvals` (MANAGERS_UP)
`v.list` → `leaveRepository.list`. *List:* scope from `accessScope` (HR all, manager subtree, employee self), filters `status/from/to/leaveTypeId/departmentId/employeeId` (`employeeId` scope-checked). *Me:* only the caller's. *Pending approvals:* HR → every `PENDING`; manager → `PENDING` where the requester's `manager_id` is the caller (only people they can actually approve).

#### `GET /leave/requests/:id` (ALL, scoped)
`svc.getRequest`: `404` → `assertCanSee(owner)` → request + its `documents[]` metadata.

#### `POST /leave/requests/:id/documents` (ALL) · `GET /leave/requests/:id/documents/:docId` (ALL)
Upload: `v.id` → `documentUpload` (multer memory, size limit, magic-byte sniff for JPEG/PNG/**PDF**, must match declared MIME) → `svc.addDocument`: only the owner or HR (`403`); request must be `PENDING`/`APPROVED` (`409`) → `INSERT leave_request_documents (LONGBLOB)`. Download: `assertCanSee(owner)` (so the employee, their manager chain and HR) → bytes with `Content-Disposition: attachment`, `nosniff`.

#### `GET /leave/balances` · `GET /leave/balances/employees/:id` (ALL, scoped)
`svc.balances`: target = self or `:id` (`assertCanSee`); **[tx]** `ensureBalances(year)` (lazy creation, idempotent via `INSERT IGNORE`) → read from view `v_leave_balance_available` → `{ year, balances:[{entitled, adjusted, used, available}] }`. `year` defaults to the current year.

#### `GET /leave/history` · `GET /leave/history/employees/:id` (ALL, scoped)
All of the employee's requests + the year's **balance ledger** (`leave_balance_transactions`: ENTITLEMENT / DEDUCTION / REFUND / ADJUSTMENT).

#### `POST /leave/balances/adjust` (ADMINS)
`v.adjust` (employee, type, year, non-zero `amount`, mandatory `note`) → `svc.adjustBalance` **[tx]**: type must have a policy (unpaid → `422`) → `ensureBalances` → lock balance → result would be negative → `422 NEGATIVE_BALANCE` → ledger `ADJUSTMENT` + `adjusted += amount` → notify employee → audit `LEAVE_BALANCE_ADJUST` → returns fresh balances.

#### `GET /leave/team` (MANAGERS_UP)
Scoped ids minus yourself → pending/approved leave overlapping `from…to` (default next 30 days).

#### `GET /leave/types` (ALL) · `POST /leave/types` · `PUT /leave/types/:id` (ADMINS)
List: employees see only active types, HR sees all, each with its policy (entitlement, carry-forward max, half-day allowed, max consecutive). Create: `v.typeCreate` (policy fields validated **only if** a `policy` object is sent) → insert type (+ `upsertPolicy`). Update: change name/paid/document-required/active; `policy:null` removes the policy (type becomes unlimited like unpaid), an object upserts it. Audited.

---

### 3.8 Holidays, weekly offs, calendars — `routes/holidayRoutes.js` → `holidayController` → `holidayService` → `holidayRepository`

| Endpoint | Flow |
|---|---|
| `GET /holidays?from=&to=&location=` (ALL) | `v.list` → `holidayRepository.list`; with `location` it returns holidays for `ALL` **plus** that location |
| `POST /holidays` (ADMINS) | `v.create` (date, name, optional `location` default `ALL`, `isOptional`) → insert; `UNIQUE(holiday_date, location)` → `409` on duplicates → audit `HOLIDAY_CREATE` |
| `PUT /holidays/:id` (ADMINS) | `404` check → dynamic update → returns row |
| `DELETE /holidays/:id` (ADMINS) | delete (`404` if absent) → audit `HOLIDAY_DELETE` |
| `GET /weekly-offs` (ALL) | all configured `(location, day_of_week)` rows (0 = Sunday … 6 = Saturday; seeded `ALL`: Sun, Sat) |
| `PUT /weekly-offs` (ADMINS) | `v.weeklyOffs` (`days[]` each 0–6) → **[tx]** delete that location's rows and insert the new set → audit `WEEKLY_OFF_UPDATE`. A location with its own rows overrides `ALL` for leave counting and calendars |
| `GET /calendar/leave?year=&month=&departmentId=` (ALL, scoped) | `holidayService.leaveCalendar`: month range (default current) → leave list from `leaveRepository.list` for `accessScope` ids (pending + approved) + holidays + weekly-off days for the caller's location |
| `GET /calendar/attendance?year=&month=&employeeId=` (ALL, scoped) | target = self or `employeeId` (`assertCanSee`) → for every date in the month: the attendance record (if any) + `calendarDayType` = `HOLIDAY` / `WEEKLY_OFF` / `WORKING_DAY` (and holiday name) using that employee's location |

---

### 3.9 Dashboard and reports — `routes/reportRoutes.js` → `reportController` → `reportService` → `reportRepository`
Everything is a live SQL aggregate (no cached/hardcoded numbers) and is **scoped**: HR sees the whole company, a manager only their subtree. No endpoint here returns salary.

| Endpoint | Roles | Flow |
|---|---|---|
| `GET /dashboard` | MANAGERS_UP | `reportService.dashboard`: `Promise.all` of: employee counts (total/active/inactive), headcount by department (HR: view `v_department_headcount`), today's attendance by status, employees on approved leave today, leave-by-status for the year, pending approvals, birthdays and work anniversaries in the next 30 days (month/day only — no birth year) |
| `GET /upcoming-events?days=` | MANAGERS_UP | birthdays + anniversaries for 1–365 days (`400` above that) |
| `GET /reports/joiners-exits?from=&to=` | MANAGERS_UP | joiners (`joining_date`) and exits (`exit_date`) in range (default Jan 1 → today); CSV rows tagged `JOINER`/`EXIT` |
| `GET /reports/leave-balances?year=&departmentId=` | MANAGERS_UP | rows from `v_leave_balance_available ⨝ employees ⨝ departments` for scoped employees |
| `GET /reports/leave-summary?from=&to=&departmentId=` | MANAGERS_UP | request count and days grouped by department / leave type / status for requests overlapping the range |
| `GET /reports/departments` | ADMINS | per department: head, active/inactive employees, active teams |
| `GET /reports/designations` | ADMINS | per designation: level, active, active employees |

Add `?format=csv` to any report: the controller calls `sendCsv`, which sets `Content-Type: text/csv` + `Content-Disposition: attachment` and **neutralises spreadsheet-formula injection** (cells starting with `= + - @` get a leading `'`).
Related attendance reports (`/attendance/reports/monthly|department`) are in 3.6.

---

### 3.10 Notifications — `routes/notificationRoutes.js` → `notificationController` → `notificationService` → `notificationRepository` (ALL roles, own notifications only)
Notifications are **created as a side effect** of other flows, inside the same transaction where useful: leave applied / approved / rejected / cancelled / balance adjusted, attendance corrected, employee onboarded, manager or department changed. Recipients are resolved from employee ids to `users.id`; employees without a login account simply get none.

| Endpoint | Flow |
|---|---|
| `GET /notifications?unread=&page=&limit=` | `listForUser(req.user.id)` — the `WHERE user_id = ?` is always the caller |
| `GET /notifications/unread-count` | `COUNT(*) … is_read = 0` |
| `GET /notifications/:id` | load by id; **if it belongs to someone else the answer is `404`**, not 403, so existence isn't leaked |
| `POST /notifications/:id/read` | ownership check as above → `UPDATE … is_read=1, read_at` scoped to `user_id` → returns the notification |
| `POST /notifications/read` | body `ids[]` (optional): with ids → mark those **that belong to the caller**; without → mark all the caller's unread. Foreign ids are silently ignored. Returns `{ updated }` |

---

### 3.11 Audit logs — `GET /audit-logs` (SUPER_ADMIN, HR_ADMIN)
`routes/index.js` applies `authorize(SUPER_ADMIN, HR_ADMIN)` at mount time → `v` (page, `entityType`, `entityId`, `userId`) → `auditRepository.list` (`ORDER BY id DESC`). Rows are written by controllers after successful sensitive actions (login, password change, employee create/update/deactivate/reactivate, account/role changes, job-history, department changes, attendance correction/manual entry, leave approve/reject/cancel/adjust, leave-type changes, holiday and weekly-off changes). Each row stores user, action, entity, JSON details (never passwords), IP and `requestId`.

---

### 3.12 Non-API endpoints
| Endpoint | Flow |
|---|---|
| `GET /health` | handled in `app.js` before the API limiter/auth: `SELECT 1` → `{status:"ok"}` or `503 {status:"degraded"}` |
| `GET /api-docs`, `/api-docs/openapi.json` | mounted before `helmet`; served by `swagger-ui-express` from `src/docs/openapi.js` |

---

## Part 4 — Three requests traced end to end

### A. `POST /api/v1/leave/requests` by an employee (Sofia, EMPLOYEE) — 5 days of Casual Leave
```
POST /api/v1/leave/requests   Authorization: Bearer <JWT>
{ "leaveTypeId":1, "startDate":"2026-11-02", "endDate":"2026-11-08", "reason":"Vacation" }

requestId → helmet → cors → json → query pin → logger → api rate limiter
routes/index  →  authenticate: verify JWT → SELECT users⨝roles → req.user={id:7, employeeId:6, role:EMPLOYEE}
routes/leaveRoutes  →  v.apply → validate (ids, YYYY-MM-DD dates, reason 3-1000 chars)
leaveController.apply  →  leaveService.apply
   quick checks (dates, same year, not >30d back)
   BEGIN
     SELECT … FROM employees WHERE id=6 FOR UPDATE           ← serialises Sofia's own requests
     leave type + policy; computeDays: Mon–Sun, Sat/Sun are weekly off → 5 days
     overlap query (PENDING/APPROVED)                         ← none
     ensureBalances(2026): INSERT IGNORE leave_balances (+ENTITLEMENT ledger rows)
     SELECT … FROM leave_balances … FOR UPDATE; available 12 − pending 0 ≥ 5 ✔
     INSERT leave_requests (PENDING, days=5)
     INSERT notifications → Sofia's manager (Maria)
   COMMIT
leaveRepository.findById  →  201 { success:true, message:"Leave request submitted", data:{ id, days:5, status:"PENDING", … } }
```
Then Maria `POST /leave/requests/:id/approve`: `authorize(MANAGERS_UP)` → `decide` → lock request → *is she Sofia's `manager_id`?* ✔ → still PENDING ✔ → lock balance → ledger `DEDUCTION −5` → `used = 5` → `ON_LEAVE` attendance rows → status `APPROVED` → notify Sofia → audit `LEAVE_APPROVE`. Pressing approve again returns `409 ALREADY_PROCESSED`.

### B. `POST /api/v1/employees` by HR — create an employee with a login
```
authenticate → authorize(ADMINS) → v.create → validate
employeeController.create → employeeService.create
   whitelist fields · email unique? · bcrypt(account.password)
   BEGIN
     validate department/designation/team/manager
     INSERT employees (code EMP-1013)          INSERT job_history (JOINED)
     INSERT users (employee_id, role)          INSERT notifications ×2
   COMMIT
audit EMPLOYEE_CREATE → getById after commit → 201 (HR tier: includes compensation + account)
```
A duplicate email stops at `ensureEmailFree` (`409 DUPLICATE_EMAIL`); a race that slips past it is caught by the DB unique key (`409 DUPLICATE`).

### C. `GET /api/v1/org-chart` by any logged-in user
```
authenticate (no authorize: every role may read) → depth/departmentId validators
orgController.full → orgService.hierarchy
   orgRepository.treeRows : recursive CTE from roots, active only, path-guarded, depth ≤ 25
   assemble() → nested JSON, directReportCount per node
   (optional) department pruning
   unreachable-employee check → data.warnings if a legacy cycle exists
→ 200 { roots:[ { id, name, designation, department, profilePictureUrl, managerId, subordinates:[…] } ], totalNodes }
```

---

## Part 5 — Quick reference: who may call what

| Area | EMPLOYEE | MANAGER | HR_ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Own profile, attendance, leave, notifications | ✔ | ✔ | ✔ | ✔ |
| Employee directory / org chart / holidays / lists of departments, teams, designations | ✔ read | ✔ read | ✔ | ✔ |
| Employee salary & personal fields of others | ✘ | ✘ | ✔ | ✔ |
| Create/update/deactivate employees, accounts, job history, org setup, holidays | ✘ | ✘ | ✔ | ✔ |
| Change a login role | ✘ | ✘ | ✘ | ✔ |
| Team attendance / leave / dashboard / reports | ✘ | ✔ own subtree | ✔ all | ✔ all |
| Approve or reject leave | ✘ | ✔ direct reports | ✔ anyone's (not own) | ✔ anyone's (not own) |
| Correct attendance, adjust balances, leave types | ✘ | ✘ | ✔ | ✔ |
| Audit logs, department/designation reports | ✘ | ✘ | ✔ | ✔ |

## Part 6 — Where to look in the code

| Layer | Folder | One file per… |
|---|---|---|
| Routes | `src/routes/` | module (`authRoutes`, `employeeRoutes`, …); `index.js` wires them and applies `authenticate` |
| Validators | `src/validators/` | module; `common.js` has shared `idParam`, `dateField`, `passwordField` |
| Middleware | `src/middleware/` | `auth`, `validate`, `rateLimiters`, `upload`, `errorHandler`, `requestId` |
| Controllers | `src/controllers/` | module; HTTP in/out and audit calls only |
| Services | `src/services/` | module; business rules, transactions, notifications, `accessScope` |
| Repositories | `src/repositories/` | table group; all SQL lives here |
| Models | `src/models/employeeMapper.js` | field-level visibility |
| Config / utils | `src/config/`, `src/utils/` | env, DB pool + `withTransaction`, JWT settings, password/CSV/date/pagination helpers |
| Docs | `src/docs/` | OpenAPI table + Swagger mount |

A good way to learn it: pick any route in `src/routes/*.js`, then open the controller function it names, then the service function that controller calls, then the repository functions that service uses — that is exactly the order the request travels.
