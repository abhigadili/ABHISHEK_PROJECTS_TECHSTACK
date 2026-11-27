# Backend API Integration

How the Angular app talks to the existing Express.js / MySQL backend. Everything here was derived by **reading the backend source** and by **calling the running API**, not by assuming endpoint names.

| | |
|---|---|
| Backend location | `~/Documents/NodeJS_Projects/EMS-ExpressJS` (Express 5.3, MySQL 8, JWT) |
| API base URL | `http://localhost:4100/api/v1` (`API_PREFIX=/api/v1`, `PORT=4100`) |
| Swagger UI / contract | `http://localhost:4100/api-docs` · `docs/api/openapi.json` (99 operations) |
| Health | `GET /health` (no prefix, no auth) |
| Backend modified? | **No.** Zero backend code or schema changes were made. |

> **OpenAPI vs implementation:** a script compared every path+method in `openapi.json` with every `router.get/post/put/patch/delete` in `src/routes/*.js`: **99 documented = 99 implemented, no drift**. The OpenAPI file was therefore used as the primary contract; the controllers/validators were read for field-level detail the spec abbreviates.

## 1. How the frontend reaches the API (and CORS)

The backend's CORS allow-list is `CORS_ALLOWED_ORIGINS=http://localhost:3000` and `credentials:false`. Instead of editing the backend `.env`, the Angular dev server **proxies** `/api` to the backend (`proxy.conf.json` → `http://localhost:4100`), so the browser sees a same-origin request and CORS never applies. `environment.apiBaseUrl` is therefore the relative `/api/v1`.

| Mode | How `/api/v1` is resolved |
|---|---|
| `ng serve` | dev-server proxy → `:4100` (`proxy.conf.json`) |
| `ng serve --configuration e2e` | proxy → isolated **test** backend `:4101` (`proxy.conf.e2e.json`) |
| production build | same-origin: serve `dist/` behind a reverse proxy that routes `/api` to Express (nginx example in README), **or** change `environment.ts` to an absolute URL and add that origin to `CORS_ALLOWED_ORIGINS` |

## 2. Authentication mechanism

* `POST /auth/login {email,password}` **or** `{username,password}` → `{ accessToken, refreshToken, tokenType:"Bearer", expiresIn:"15m", user:{id,email,role,employeeId} }`.
* Tokens are returned **in the JSON body** (no HttpOnly cookies, no CSRF cookie), so JavaScript must hold them. Chosen storage: **access token in memory only**, **refresh token in `sessionStorage`** (survives reload, dies with the tab, never in `localStorage`). See `core/services/token-storage.service.ts`.
* Access token: HS256 JWT, 15 min. Sent as `Authorization: Bearer …`. The backend re-loads the account on every request, so deactivation takes effect immediately (`401 ACCOUNT_DISABLED`).
* **Refresh rotation:** `POST /auth/refresh {refreshToken}` returns a *new* pair and revokes the old token. Re-using an already-rotated token is treated as theft and **revokes the whole token family** (`401 REFRESH_TOKEN_REUSED`). Consequence for the frontend: concurrent 401s must share **one** refresh request — implemented in `AuthService.refreshAccessToken()` (a `shareReplay`ed in-flight observable) and covered by `interceptors.spec.ts`.
* `POST /auth/logout {refreshToken}` revokes the family (idempotent, no auth). `POST /auth/logout-all` revokes every session. **Changing or resetting a password revokes all sessions** → the app signs the user out after `change-password`.
* Forgot/reset: `POST /auth/forgot-password {email}` always answers the same text (no account enumeration). The reset token is only returned in the response when the backend runs with `EXPOSE_RESET_TOKEN=true` (dev/test); otherwise it is delivered out-of-band (mailer plug-in point), so the UI never assumes it receives one.
* Rate limits: login 10/min (`LOGIN_RATE_LIMIT_MAX`), sensitive endpoints stricter, API 300/min.

## 3. Response and error envelopes

```jsonc
// success
{ "success": true, "message": "…", "data": <T>, "meta": { "page":1, "limit":20, "total":57, "totalPages":3 } }   // meta only on paged lists
// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
    "details": [ { "field": "phone", "message": "…", "location": "body" } ],   // only for 400 validation
    "requestId": "uuid" } }
```

Error codes seen: `VALIDATION_ERROR` (400), `INVALID_CREDENTIALS`/`INVALID_TOKEN`/`ACCOUNT_DISABLED`/`REFRESH_TOKEN_*` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `DUPLICATE`/`DUPLICATE_EMAIL`/`IN_USE` (409), `UNPROCESSABLE`/`CONSTRAINT_VIOLATION` (422), `FILE_TOO_LARGE` (413), `INTERNAL_ERROR` (500). TypeScript mirrors live in `core/models/api.models.ts`; `core/errors/app-error.ts` normalises every failure to `AppError`.

**Pagination / filter / sort conventions:** `page` (1-based), `limit` (default 20, max 100), `q` free-text, `sort=field:asc|desc` (employees: `name, employeeCode, joiningDate, department, designation, status, createdAt`), date filters `from`/`to` as `YYYY-MM-DD`. Dates are `YYYY-MM-DD` strings; timestamps are UTC (`YYYY-MM-DD HH:mm:ss` or ISO `…Z`) — parsed explicitly in `shared/utils/dates.ts`.

## 4. Roles and permissions

Roles: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`. Backend groups: **ADMINS** = SUPER_ADMIN+HR_ADMIN, **MANAGERS_UP** = ADMINS+MANAGER.

| Capability | EMPLOYEE | MANAGER | HR_ADMIN | SUPER_ADMIN |
|---|:-:|:-:|:-:|:-:|
| Own profile, attendance, leave, notifications | ✔ | ✔ | ✔ | ✔ |
| Employee directory (work fields) | ✔ | ✔ | ✔ | ✔ |
| Personal/compensation fields of others | self only | ✘ | ✔ | ✔ |
| Create/edit/deactivate employees, picture upload, job history, accounts | ✘ | ✘ | ✔ | ✔ |
| Assign role (`PUT /employees/:id/role`) | ✘ | ✘ | ✘ | ✔ |
| Departments / teams / designations / holidays / leave types / balance adjust (write) | ✘ | ✘ | ✔ | ✔ |
| Attendance correction / manual record | ✘ | ✘ | ✔ | ✔ |
| Approve/reject leave, team leave, pending approvals | ✘ | ✔ (own tree) | ✔ | ✔ |
| Dashboard, upcoming events, most reports | ✘ | ✔ (own tree) | ✔ | ✔ |
| Department/designation reports, audit logs | ✘ | ✘ | ✔ | ✔ |

Data scope: admins see everyone; managers see themselves + their reporting subtree; employees see themselves (`services/accessScope.js`). The UI mirrors this in `core/services/permission.service.ts` **for display only** — every route/guard/directive is a convenience; the backend enforces all of it.

## 5. Endpoint catalogue (what the Angular services call)

All paths are relative to `/api/v1`. “Auth” = Bearer token required (everything except `/auth/login|register|registration-options|username-available|refresh|logout|forgot-password|reset-password`).

### Auth — `core/services/auth.service.ts`
| Method & path | Auth | Request | Response |
|---|---|---|---|
| POST `/auth/login` | – | `{email,password}` or `{username,password}` | `LoginResponse` |
| POST `/auth/register` | – | multipart: `firstName,lastName,username,email,mobile,password,dateOfBirth,gender` (+ optional `address,departmentId,designationId`, picture in `file`); no `confirmPassword` | `RegistrationResult` `{id,employeeId,employeeCode,username,email,role:'EMPLOYEE'}`; 409 `DUPLICATE_USERNAME`/`DUPLICATE_EMAIL` with per-field `details` |
| GET `/auth/registration-options` | – | – | `{departments:[{id,name}],designations:[{id,name}]}` (active only) |
| GET `/auth/username-available?username=` | – | – | `{available:boolean}` |
| POST `/auth/refresh` | – | `{refreshToken}` | `TokenPair` |
| POST `/auth/logout` | – | `{refreshToken}` | `null` |
| POST `/auth/logout-all` | ✔ | – | `null` |
| GET `/auth/me` | ✔ | – | `{id,email,role,lastLoginAt,employee:{id,employeeCode,firstName,lastName,workEmail,status,departmentId,managerId}\|null}` |
| POST `/auth/forgot-password` | – | `{email}` | `null` or `{resetToken}` (dev) |
| POST `/auth/reset-password` | – | `{token,newPassword}` | `null` |
| POST `/auth/change-password` | ✔ | `{currentPassword,newPassword}` | `null` (all sessions revoked) |

Password policy (validators + backend): 10–72 chars, upper, lower, digit, special.

### Employees & profile — `employee.service.ts`, `profile.service.ts`, `picture.service.ts`
| Method & path | Roles | Notes |
|---|---|---|
| GET `/employees` | all | `q, departmentId, teamId, designationId, managerId, status(ACTIVE\|INACTIVE\|TERMINATED\|ALL), employmentType, sort, page, limit` → paged `Employee[]` (sensitive fields only for admin/self) |
| POST `/employees` | ADMINS | `firstName,lastName,workEmail,joiningDate` required; optional personal/address/emergency-contact/job/salary fields, `employeeCode`, `account:{role,password}` → **201 full employee** |
| GET `/employees/:id` | all (scoped) | `Employee` |
| PUT / PATCH `/employees/:id` | ADMINS | any subset; `changeType`+`effectiveDate`+`notes` record a promotion/transfer in job history |
| DELETE or POST `/employees/:id/deactivate` | ADMINS | `{reason?, exitDate?, reassignReportsTo?}` |
| POST `/employees/:id/reactivate` | ADMINS | – |
| GET / POST `/employees/:id/job-history` | all / ADMINS | history `[{changeType,effectiveDate,from*/to* …}]` |
| POST `/employees/:id/account` · PUT `/employees/:id/role` | ADMINS · SUPER_ADMIN | `{role,password}` · `{role}` |
| GET / PUT / DELETE `/employees/:id/picture` | all / ADMINS / ADMINS | PUT = multipart field **`file`** (jpeg/png/webp ≤ 2 MB, MIME *and* magic-bytes checked). GET returns the **binary image and requires the Bearer header**, so `<img src>` cannot be used — the app fetches a Blob (`PictureService`). |
| GET / PATCH `/profile` | all | PATCH accepts **only** `personalEmail, phone, addressLine, city, state, country, postalCode, emergencyContact*` |
| GET / PUT / DELETE `/profile/picture` · POST `/profile/change-password` | all | own picture / password |

### Departments, teams, designations — `department.service.ts`, `designation.service.ts`, `reference-data.service.ts`
| Method & path | Roles | Notes |
|---|---|---|
| GET `/departments` · GET `/departments/:id` | all | `{id,code,name,description,isActive,headEmployeeId,headName,headcount,…}`; filters `q,isActive,page,limit` |
| POST / PUT `/departments(/:id)` | ADMINS | `code` `^[A-Z0-9_-]+$`, `name`, `description`, `headEmployeeId` |
| DELETE `/departments/:id` (deactivate) · POST `/departments/:id/activate` | ADMINS | 409 if active employees remain |
| GET `/teams`, `/teams/:id` · POST `/teams` · PUT `/teams/:id` · PUT `/teams/:id/members` | all / ADMINS | the Angular app **lists** teams (department details); team editing UI is not built (see §7) |
| GET/POST/PUT `/designations(/:id)` | all / ADMINS | `{id,name,description,jobLevel(1-20),isActive,headcount}` |

### Organization chart — `organization.service.ts`
`GET /org-chart?departmentId&depth` → `{roots:[node…], totalNodes, warnings?}` with **nested** `subordinates[]`; `GET /org-chart/search?q&rootId`; `GET /org-chart/employees/:id` (subtree), `/employees/:id/direct-reports`, `/employees/:id/reporting-chain` → `{employee, chain:[{level,…}]}`. All authenticated users.

### Attendance — `attendance.service.ts`
POST `/attendance/check-in {workMode?,remarks?}`, POST `/attendance/check-out {remarks?}`, GET `/attendance/me`, GET `/attendance` (scope-filtered; `from,to,employeeId,departmentId,status,page,limit`), GET `/attendance/:id`, GET `/attendance/summary`, GET `/attendance/reports/monthly` (MANAGERS_UP, `year,month`), GET `/attendance/reports/department` (ADMINS), POST `/attendance` (ADMINS, manual), PUT `/attendance/:id` (ADMINS, correction; **`reason` mandatory**, audited). `GET /attendance*` also accepts `format=csv`.

### Leave — `leave.service.ts`
GET/POST/PUT `/leave/types` (policy `{annualEntitlement,carryForwardMax,allowHalfDay,maxConsecutiveDays}`), GET `/leave/balances` (+`/balances/employees/:id`), POST `/leave/balances/adjust` (ADMINS, non-zero `amount`, `note`), GET `/leave/history`, POST `/leave/requests`, GET `/leave/requests` · `/requests/me` · `/requests/pending-approvals` (MANAGERS_UP) · `/requests/:id`, POST `/leave/requests/:id/approve|reject` (MANAGERS_UP) and `/cancel`, GET `/leave/team` (MANAGERS_UP), POST `/leave/requests/:id/documents` (multipart `file`, jpeg/png/pdf), GET `/leave/requests/:id/documents/:docId` (binary, Bearer).

### Holidays & calendars — `holiday.service.ts`
GET/POST/PUT/DELETE `/holidays` (write = ADMINS; one holiday per date+location → duplicate is a 409), GET/PUT `/weekly-offs` (`{days:[0..6]}`), GET `/calendar/leave?year&month&departmentId`, GET `/calendar/attendance?year&month&employeeId`.

### Notifications — `notification.service.ts`
GET `/notifications?unread&page&limit`, **GET `/notifications/unread-count` → `{unread:n}`**, GET `/notifications/:id`, POST `/notifications/:id/read`, POST `/notifications/read {ids?}` (omit `ids` = all) → `{updated:n}`. **No WebSocket or SSE endpoint exists**, so “real time” is polling (§7).

### Dashboard & reports — `dashboard.service.ts`, `report.service.ts`
GET `/dashboard` (MANAGERS_UP) → `{asOf, employees:{total,active,inactive}, headcountByDepartment[], attendanceToday{}, onLeaveToday, leaveThisYear{}, pendingLeaveApprovals, upcomingBirthdays[], upcomingAnniversaries[]}`; GET `/upcoming-events?days`; reports (all accept `format=csv`): `/reports/joiners-exits`, `/reports/leave-balances`, `/reports/leave-summary` (MANAGERS_UP), `/reports/departments`, `/reports/designations` (ADMINS). GET `/audit-logs` (ADMINS).

## 6. Contract findings worth knowing

1. **`workLocation: null` → HTTP 500** on `POST/PUT /employees`: `employees.work_location` is `NOT NULL DEFAULT 'HQ'`, but the service passes `null` through to SQL (`Column 'work_location' cannot be null`). The validator allows `null`. *Frontend workaround:* omit `workLocation` when blank (`employee-form.component.ts`, covered by a unit test). *Smallest backend fix:* drop null/empty `work_location` before `INSERT/UPDATE` (or answer 400). Not applied — backend untouched.
2. The `POST /employees` response is the **full employee** (201), not just `{id}` (the service returns `{id}` internally; the controller re-reads).
3. `PUT /employees/:id` doubles as the promotion/transfer API: sending `changeType`, `effectiveDate`, `notes` with the changed fields writes the job-history row (`job-change-dialog.component.ts`).
4. The employee list is a **directory**: every authenticated user can list/search everyone; only the field set differs by role. The “duplicate e-mail” async validator relies on this (`EmployeeService.emailExists`).
5. List endpoints return the array in `data` and paging in `meta` (not a `{items,total}` object) — normalised to `Paged<T>` in `ApiService.getPaged`.
6. **Request ids & CORS:** the backend creates its own `X-Request-Id` per request (response header + `error.requestId`) and ignores an incoming one. Its CORS allow-list is only `Content-Type, Authorization`, so a custom *request* header would fail the preflight on a **cross-origin** deployment. The app therefore sends its own `X-Request-Id` only when the API base URL is relative/same-origin (`core/interceptors/interceptors.ts`, covered by a unit test) and relies on the server's `requestId` otherwise.
7. Rate limiting is per IP; the Playwright suite runs against a test backend (`NODE_ENV=test`) where limits are effectively off.

## 7. Known limitations and missing APIs (nothing is mocked)

| Requirement from the brief | Backend status | What the app does | Smallest backend enhancement (**not applied**; needs approval) |
|---|---|---|---|
| Education history, previous work experience, skills & certifications | **No endpoints, no tables** | The form/FormArray UI exists and persists to **browser `localStorage` only**, with a visible notice on every screen that shows it (`core/services/employee-extras.service.ts`). Never sent to the server, never shown as server data. | `employee_education`, `employee_experience`, `employee_skills` tables + `GET/PUT /employees/:id/education|experience|skills` (replace-all semantics fit a FormArray perfectly). |
| Multiple emergency contacts | Single contact (`emergencyContactName/Phone/Relation`) | One nested group in the form. | `employee_emergency_contacts` 1-to-many. |
| User collection (`GET /users`) | **None** — accounts belong to employees | Users & Roles screen is built on `GET /employees` (admins receive `account:{userId,role}`), with `POST /employees/:id/account`, `PUT /employees/:id/role`, (de)activation via the employee. | `GET /users` listing (id, email, role, isActive, lastLoginAt). |
| “Email already used?” check | None | Async validator searches the directory (`GET /employees?q=…&status=ALL`) and matches the exact address; backend `409 DUPLICATE_EMAIL` stays authoritative. | `GET /employees/exists?email=`. |
| Notification push | No WebSocket/SSE | Polling `GET /notifications/unread-count` every 30 s (dev) / 60 s (prod) while logged in; manual refresh after actions. | SSE endpoint `GET /notifications/stream`. |
| Employee CSV export | Only reports have `format=csv` | “Export CSV” on the employee list assembles the file **client-side** from the same filtered list API (all pages, 3 in parallel). | `GET /employees?format=csv`. |
| User preferences (theme, page size, notification toggles) | None | Settings are explicitly **browser-local** presentation preferences (`preferences.service.ts`), labelled as such. | `GET/PUT /profile/preferences`. |
| Team management UI | API exists (`/teams`) | Teams are listed on the department page; create/assign-members UI was out of the requested scope. | – |
| Department “job grade” separate from `jobLevel` | Only `jobLevel` (1–20) | Level shown as **L{n}** and used as the grade. | – |
| Per-employee attendance/leave **calendar for others** | `/calendar/attendance` supports `employeeId` for permitted viewers | The app shows the signed-in user's attendance calendar and the team **leave** calendar. | – |

## 8. Environment used for verification

Because the development database holds real sample data and the admin password is not recorded, verification used the backend's **own isolated test database** (`ems_expressjs_test`, created by the backend's `tests/globalSetup.js`, which refuses to touch any DB not ending in `_test`):

```bash
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
NODE_ENV=test node -e "require('./tests/globalSetup')()"                       # fresh schema
NODE_ENV=test ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/create-admin.js       # first SUPER_ADMIN
NODE_ENV=test PORT=4101 node src/server.js                                      # test API on :4101
node ~/Documents/Angular_Projects/EMS-Angular/e2e/seed.mjs                      # departments, designations, 5 users, 1 holiday, 1 pending leave
```
No credentials are stored in the repository: the Playwright suite reads `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (and optionally `E2E_USER_PASSWORD`) from the environment.
