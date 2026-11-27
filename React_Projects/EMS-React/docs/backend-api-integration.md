# Backend API Integration — EMS-ExpressJS

This document is derived from reading the backend source (`routes/`, `validators/`, `middleware/`, `services/`) and from
calling a live instance. Nothing here is assumed from the prompt; where a prompt feature has no backend support it is listed
under **Missing APIs**.

| Item | Value |
|---|---|
| Backend project | `~/Documents/NodeJS_Projects/EMS-ExpressJS` (Express 5.3, MySQL, JWT) — **not modified** |
| Dev API base URL | `http://localhost:4100/api/v1` (`PORT=4100`, `API_PREFIX=/api/v1`) |
| Swagger UI | `http://localhost:4100/api-docs` |
| Health | `GET /health` → `{status:"ok"}` (outside the `/api/v1` prefix) |
| SPA → API path | the SPA calls the relative path `/api/v1`; Vite's dev/preview proxy forwards `/api` to the backend |

## Authentication mechanism

* **Bearer JWT access token** (HS256, `JWT_ACCESS_TTL=15m`) + **opaque refresh token** (48 random bytes, base64url, TTL 7 days,
  stored hashed). Tokens are returned **in the JSON body** — there are no cookies, so no CSRF handling is needed
  and CORS is `credentials:false`.
* `POST /auth/login` → `{accessToken, refreshToken, tokenType:"Bearer", expiresIn:"15m", user:{id,email,role,employeeId}}`.
* `POST /auth/refresh {refreshToken}` → a **new pair**. Refresh tokens **rotate**; replaying an already-rotated token revokes the
  whole token family (`REFRESH_TOKEN_REUSED`). Consequence for the client: **exactly one refresh may be in flight** — the Axios
  interceptor in `src/api/httpClient.ts` shares a single promise between concurrent 401s.
* `POST /auth/logout {refreshToken}` revokes the family (public route). `POST /auth/logout-all` (authenticated) revokes every session.
* Password reset: `POST /auth/forgot-password {email}` (always 200; the token is only returned when the server sets
  `EXPOSE_RESET_TOKEN=true`, otherwise it is "mailed"), `POST /auth/reset-password {token,newPassword}`.
  `POST /auth/change-password` (also `POST /profile/change-password`) revokes all sessions → the client must log in again.
* Password policy: 10–72 chars with upper, lower, digit and special character.
* Authenticated requests: `Authorization: Bearer <accessToken>`. 401 codes: `UNAUTHORIZED`, `INVALID_TOKEN` (also "Access token expired"),
  `ACCOUNT_DISABLED`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED`.
* Rate limits: 15-minute windows; login 10, forgot/reset/change 20, general API 300 (HTTP 429 `RATE_LIMITED`).
* Browser requirement: CORS allow-list (`CORS_ALLOWED_ORIGINS=http://localhost:3000`) permits only `Content-Type` and `Authorization`
  headers. The dev/preview proxy makes calls same-origin, which sidesteps this; a correlation header `X-Request-Id` is therefore only
  sent for same-origin calls (the backend generates its own `requestId` and returns it in error bodies).

## Envelope and conventions

```jsonc
// success
{ "success": true, "message": "…", "data": <payload|null>, "meta": { "page":1, "limit":20, "total":7, "totalPages":1 } } // meta only on lists
// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{"field":"workEmail","message":"…","location":"body"}], "requestId": "uuid" } }
```

* Pagination: `?page=` (≥1) and `?limit=` (1–100, default 20). Sorting (employees only): `?sort=<field>[:asc|:desc]` with
  `name, employeeCode, joiningDate, department, designation, status, createdAt`.
* Dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC for attendance (`2026-11-06T07:31:28Z`) but `YYYY-MM-DD HH:mm:ss` (UTC) for
  `createdAt/updatedAt/readAt/decidedAt`.
* Error statuses seen: 400 `VALIDATION_ERROR`/`INVALID_*`, 401, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 (`DUPLICATE`, `IN_USE`, conflicts),
  413 `FILE_TOO_LARGE`, 422 (business rules / constraints), 429, 500 `INTERNAL_ERROR`, 503 `RETRY`.
* CSV: any `?format=csv` returns `text/csv` instead of the envelope.

## Roles and permissions

Roles: `SUPER_ADMIN`, `HR_ADMIN` ("admins"), `MANAGER`, `EMPLOYEE`. Field-level visibility on employees: admins and the employee
themself see personal data + compensation (+ `account` for admins); everyone else gets work fields only. Data scope (e.g. a manager sees
their reporting subtree) is enforced server-side in `services/accessScope.js`.

| Capability | EMPLOYEE | MANAGER | HR_ADMIN | SUPER_ADMIN |
|---|:-:|:-:|:-:|:-:|
| Own profile, picture, attendance, leave, notifications | ✔ | ✔ | ✔ | ✔ |
| Dashboard, upcoming events, leave-balance/summary/joiner reports, monthly attendance report, leave approvals, team leave | – | ✔ | ✔ | ✔ |
| Create/edit/deactivate employees, departments, designations, teams, holidays, leave types, attendance correction, balance adjustment, department/designation reports, dept attendance report, audit log | – | – | ✔ | ✔ |
| Change another user's role (`PUT /employees/:id/role`) | – | – | – | ✔ |

## Endpoints

All paths are relative to `/api/v1`. "Auth" = Bearer required. `A` = admin only, `M+` = manager and above.

### Auth (`authRoutes.js`)
| Method & path | Auth | Body / notes |
|---|---|---|
| POST `/auth/login` | – | `{email,password}` **or** `{username,password}` — one of email/username is required (username is lower-cased; added with self-registration, existing e-mail logins are unchanged) |
| POST `/auth/register` | – | **public self-registration**, `multipart/form-data`: `firstName, lastName, username, email, mobile, password, dateOfBirth, gender` (required) + `address, departmentId, designationId` (optional) + optional picture in field `file` (JPEG/PNG/WebP ≤ 2 MB, magic-byte checked). `confirmPassword` is **not** part of the contract. Creates the employee record + login in one transaction, role **EMPLOYEE**, status ACTIVE. 201 → `{id, employeeId, employeeCode, username, email, role}`. Errors: 400 `VALIDATION_ERROR` (per-field `details`), 409 `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL` (both listed in `details`), 422 `INVALID_DEPARTMENT` / `INVALID_DESIGNATION`, 400 `INVALID_FILE_TYPE`, 413 `FILE_TOO_LARGE`. HR admins get an ONBOARDING notification. |
| GET `/auth/registration-options` | – | `{departments:[{id,name}], designations:[{id,name}]}` — ACTIVE ones only, for the registration form |
| GET `/auth/username-available?username=` | – | `{available:boolean}` (case-insensitive; 400 if the format is invalid) |
| POST `/auth/refresh` | – | `{refreshToken}` |
| POST `/auth/logout` | – | `{refreshToken}` |
| POST `/auth/logout-all` | ✔ | – |
| GET `/auth/me` | ✔ | `{id,email,role,lastLoginAt,employee:{id,employeeCode,firstName,lastName,workEmail,status,departmentId,managerId}}` |
| POST `/auth/forgot-password` | – | `{email}` |
| POST `/auth/reset-password` | – | `{token,newPassword}` |
| POST `/auth/change-password` | ✔ | `{currentPassword,newPassword}` |

### Profile (`profileRoutes.js`)
GET `/profile` (full employee, self tier) · PATCH `/profile` (**only** `personalEmail, phone, addressLine, city, state, country, postalCode,
emergencyContactName/Phone/Relation`) · GET/PUT/DELETE `/profile/picture` · POST `/profile/change-password`.

### Employees (`employeeRoutes.js`)
| Method & path | Role | Notes |
|---|---|---|
| GET `/employees` | ✔ | filters `q, departmentId, teamId, designationId, managerId, status(ACTIVE\|INACTIVE\|TERMINATED\|ALL), employmentType, sort, page, limit` |
| POST `/employees` | A | `firstName,lastName,workEmail,joiningDate` required; optional `middleName, personalEmail, phone, dateOfBirth, probationEndDate, addressLine, city, state, country, postalCode, emergencyContact{Name,Phone,Relation}, employmentType, designationId, departmentId, teamId, managerId, jobTitle, workLocation, salary, bonusTarget, salaryCurrency, employeeCode, account:{role,password}` |
| GET `/employees/:id` | ✔ | tiered response (see above) |
| PUT/PATCH `/employees/:id` | A | same fields; plus `changeType, effectiveDate, notes` to record job history |
| DELETE `/employees/:id` · POST `/employees/:id/deactivate` | A | `{reason, exitDate, reassignReportsTo}` |
| POST `/employees/:id/reactivate` | A | – |
| GET / POST `/employees/:id/job-history` | ✔ / A | POST `{changeType: PROMOTION\|TRANSFER\|MANAGER_CHANGE\|JOB_CHANGE\|STATUS_CHANGE\|PROBATION, effectiveDate, notes}`; GET rows contain `changeType (also JOINED), effectiveDate, notes, from/to JobTitle|Designation|Department|Manager` |
| POST `/employees/:id/account` | A | `{role,password}` – create a login for an existing employee |
| PUT `/employees/:id/role` | SA | `{role}` |
| GET / PUT / DELETE `/employees/:id/picture` | ✔ / A / A | PUT is **multipart field `file`** (jpeg/png/webp ≤ 2 MB, magic-byte checked). GET is **authenticated** and returns image bytes (404 `NOT_FOUND` when none) → the SPA must fetch it with Axios as a Blob (an `<img src>` cannot send the Bearer header). |

Employee object: `id, employeeCode, firstName, middleName, lastName, fullName, workEmail, phone, status, employmentType,
designation{id,name}|null, jobTitle, department{id,name}|null, team{id,name}|null, manager{id,employeeCode,name}|null, workLocation,
joiningDate, profilePictureUrl` plus (admin/self) `personalEmail, dateOfBirth, address{line,city,state,country,postalCode},
emergencyContact{name,phone,relation}, probationEndDate, exitDate, createdAt, updatedAt, compensation{salary,salaryCurrency,bonusTarget}`
plus (admin) `account{userId,role}|null`.

### Reference data (`referenceRoutes.js`)
* Departments: GET `/departments` (`q,isActive,page,limit`) · POST (A) `{code (A-Z0-9_-), name, description, headEmployeeId}` · GET `/departments/:id` ·
  PUT (A) · DELETE (A, **deactivates**) · POST `/departments/:id/activate` (A). Object: `id, code, name, description, isActive, headEmployeeId, headName, headcount, createdAt, updatedAt`.
* Teams: GET `/teams` (`q, departmentId, isActive`) · POST (A) `{departmentId,name,description,leadEmployeeId}` · GET/PUT `/teams/:id` · PUT `/teams/:id/members {employeeIds[]}`.
* Designations: GET `/designations` · POST (A) `{name, description, jobLevel 1–20}` · GET/PUT `/designations/:id` (`isActive` on update). Object: `id,name,description,jobLevel,isActive,headcount`.
* There is **no "grade" field** other than `jobLevel`, and **no department→employees endpoint**: the SPA uses `GET /employees?departmentId=`.

### Org chart (`orgRoutes.js`)
GET `/org-chart?depth=&departmentId=` → `{roots:[node], totalNodes}` where `node = {id,employeeCode,name,workEmail,designation,jobTitle,department,managerId,profilePictureUrl,directReportCount,subordinates[]}` ·
GET `/org-chart/search?q=&rootId=` → `[{…, depth, managerChainIds[]}]` · GET `/org-chart/employees/:id?depth=` (subtree) ·
GET `/org-chart/employees/:id/direct-reports` · GET `/org-chart/employees/:id/reporting-chain` → `{employee, chain:[{level,…}]}`.

### Attendance (`attendanceRoutes.js`)
POST `/attendance/check-in {workMode?: OFFICE|REMOTE|HYBRID, remarks?}` · POST `/attendance/check-out {remarks?}` · GET `/attendance/me` ·
GET `/attendance` (`from,to,employeeId,departmentId,status,page,limit,format`) · GET `/attendance/:id` · POST `/attendance` (A manual) ·
PUT `/attendance/:id` (A correction: `checkInAt,checkOutAt,status,workMode,remarks`, **`reason` 3–500 chars required**) ·
GET `/attendance/summary?from&to&employeeId` → `{from,to,byStatus:{PRESENT:n,…},totalRecords,totalHours}` ·
GET `/attendance/reports/monthly?year&month&departmentId` (M+) · GET `/attendance/reports/department?from&to` (A).
Record: `id,employeeId,employeeCode,employeeName,department{id,name},workDate,checkInAt,checkOutAt,workingHours,status,workMode,remarks,correction`.
Statuses: `PRESENT, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY, WEEKLY_OFF`. A check-out under `FULL_DAY_HOURS=6` yields `HALF_DAY`.

### Leave (`leaveRoutes.js`)
* Types: GET `/leave/types` · POST (A) `{code,name,description,isPaid,requiresDocument,policy{annualEntitlement,carryForwardMax,allowHalfDay,maxConsecutiveDays}}` · PUT `/leave/types/:id` (A).
* Balances: GET `/leave/balances?year` (own) → `{employeeId,year,balances:[{leaveTypeId,leaveTypeCode,leaveTypeName,year,entitled,adjusted,used,available}]}` ·
  GET `/leave/balances/employees/:id` · POST `/leave/balances/adjust` (A) `{employeeId,leaveTypeId,year,amount≠0,note}`.
* History: GET `/leave/history?year` → `{employeeId,year,requests[],ledger[{id,type,amount,note,leaveRequestId,createdAt,leaveTypeCode}]}` · GET `/leave/history/employees/:id`.
* Requests: POST `/leave/requests {leaveTypeId,startDate,endDate,dayPart?: FULL_DAY|FIRST_HALF|SECOND_HALF,reason(3–1000)}` · GET `/leave/requests` (scoped list; `status,from,to,employeeId,leaveTypeId,departmentId`) ·
  GET `/leave/requests/me` · GET `/leave/requests/pending-approvals` (M+) · GET `/leave/requests/:id` · POST `…/:id/approve|reject` (M+, `{note?}`; you cannot decide your own request) ·
  POST `…/:id/cancel` · POST `…/:id/documents` (multipart `file`, jpeg/png/pdf) · GET `…/:id/documents/:docId` (binary download).
* GET `/leave/team?from&to` (M+) → array of leave requests (PENDING + APPROVED) in the window.
Request object: `id,employeeId,employeeCode,employeeName,leaveType{id,code,name},startDate,endDate,dayPart,days,reason,status,decidedBy,decidedAt,decisionNote,cancelledAt,documentCount,createdAt`; `GET /leave/requests/:id` additionally returns `documents:[{id,fileName,mimeType,sizeBytes,createdAt}]`.

### Holidays & calendar (`holidayRoutes.js`)
GET `/holidays` (`from,to,location`) · POST/PUT/DELETE (A) `{holidayDate,name,location,isOptional}` · GET `/weekly-offs` → `[{id,location,dayOfWeek}]` · PUT `/weekly-offs` (A) `{location?,days:[0–6]}` ·
GET `/calendar/leave?year&month&departmentId&employeeId` → `{from,to,holidays,weeklyOffDays,leaves}` ·
GET `/calendar/attendance?year&month&employeeId` → `{employeeId,from,to,days:[{date,recorded,calendarDayType,holidayName}]}`.

### Notifications (`notificationRoutes.js`)
GET `/notifications?unread&page&limit` → `{id,userId,type,title,message,refType,refId,isRead,readAt,createdAt}` · GET `/notifications/unread-count` → `{unread}` ·
POST `/notifications/read {ids?:[]}` (**omit `ids` = mark all read**) · GET `/notifications/:id` · POST `/notifications/:id/read`.
No WebSocket / SSE endpoint exists, so the SPA **polls** the unread count (see `useNotifications`).

### Dashboard and reports (`reportRoutes.js`, M+ unless noted)
GET `/dashboard` → `{asOf, employees:{total,active,inactive}, headcountByDepartment:[{departmentId,department,headcount}], attendanceToday:{STATUS:n}, onLeaveToday, leaveThisYear:{STATUS:{requests,days}}, pendingLeaveApprovals, upcomingBirthdays:[{employeeId,employeeCode,name,date}], upcomingAnniversaries:[…]}` ·
GET `/upcoming-events?days` · GET `/reports/joiners-exits?from&to` → `{from,to,joiners[],exits[]}` · GET `/reports/leave-balances?year&departmentId&format` → `{year,rows[]}` ·
GET `/reports/leave-summary?from&to` → `{from,to,rows[]}` · GET `/reports/departments` (A) · GET `/reports/designations` (A) · GET `/audit-logs` (A; `entityType,entityId,userId`).

## Role-aware behaviour that matters for the UI
* `EMPLOYEE` receives 403 on `/dashboard` → the dashboard route shows a personal summary (own balances, attendance, notifications) built from permitted endpoints.
* `MANAGER` is scoped to their subtree for employees/leave/attendance lists.

## Known limitations / inconsistencies found
1. `workLocation: null` on `POST/PUT /employees` returns HTTP 500 (NOT NULL column) → the client omits the field when empty.
2. `GET /employees/:id/picture` is bearer-protected and 404s when absent → Blob fetch with fallback initials.
3. Refresh-token rotation means refresh must be single-flight (implemented).
4. `PATCH /profile` rejects any field outside the whitelist with a 400 (the profile form therefore sends only those fields).
5. Check-out immediately after check-in yields `workingHours:0` and status `HALF_DAY` (by design, `FULL_DAY_HOURS`).
6. The password-reset email is not delivered anywhere in dev (`mailer` stub); the token is only exposed with `EXPOSE_RESET_TOKEN=true`.

## Self-registration (added later)
No registration endpoint existed. `users` had no `username` and `employees` no `gender`, so the backend gained: `users.username VARCHAR(30) NULL UNIQUE`, `employees.gender ENUM(…) NULL` (idempotent migration: `npm run db:migrate` in EMS-ExpressJS; fresh databases get them from `02_create_tables.sql`), and the three `/auth/*` endpoints above. Passwords use the existing bcrypt helper; hashes are never returned; self-registered users always get the least-privileged `EMPLOYEE` role (elevation only via `PUT /employees/:id/role` by a SUPER_ADMIN). Usernames: 3–30 chars `[A-Za-z0-9._-]`, start with a letter/digit, stored lower-case, never contain `@`.

## Missing APIs (prompt feature → required backend work)
| Prompt feature | Status | Smallest backend enhancement proposed |
|---|---|---|
| Education history, previous work experience, skills & certifications per employee | **No endpoint** | `GET/PUT /employees/:id/qualifications` (one JSON-document table `employee_qualifications(employee_id, education JSON, experience JSON, skills JSON)`) |
| Dedicated `/users` user-management API (list/create/activate) | **No endpoint** | Not required: users are 1:1 with employees. The SPA composes user management from `GET /employees` (`account.role`), `POST /employees/:id/account`, `PUT /employees/:id/role` (SUPER_ADMIN), `deactivate/reactivate`. A thin `/users` list would only avoid the composition |
| Leave-type delete | none (deactivate via `isActive`) | none needed |
| Department → employees endpoint | none | none needed (`GET /employees?departmentId=`) |
| Job "grade" | only `jobLevel` | none needed |
| Real-time notifications | no WebSocket/SSE | none; SPA polls |
| Attendance rows for a date-range *calendar by team* | per-employee only | none needed |
| Candidate promotion/transfer **workflow** | only job-history records + `PUT /employees/:id` with `changeType` | none needed |

Because the qualifications API is missing, the education / experience / skills sections of the employee form are persisted in
`localStorage` (per employee id) behind a visible "stored in this browser only" banner. Every other form field is sent to the backend.
The backend remains untouched; the proposal above is for the owner to approve.
