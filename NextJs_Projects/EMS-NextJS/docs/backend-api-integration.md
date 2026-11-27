# Backend API integration (EMS-ExpressJS ↔ EMS-NextJS)

This frontend is a **pure client of the existing Express backend**. It adds no database, no business rules and no new backend endpoints; the backend was **not modified**.

* Backend project: `~/Documents/NodeJS_Projects/EMS-ExpressJS` (Express 5 + MySQL, JWT). Swagger UI: `http://localhost:4100/api-docs`.
* API base URL (server-side only): `EMS_API_URL=http://localhost:4100/api/v1` — read in `src/lib/server/env.ts`, **never** exposed to the browser (no `NEXT_PUBLIC_` prefix).
* Selected frontend stack: **Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 · Node 20.11** (App Router, `cacheComponents` enabled).

## 1. Who talks to whom

```text
Browser ──(HttpOnly cookies, same origin)──▶ Next.js server ──(Authorization: Bearer <access token>)──▶ Express API ──▶ MySQL
                                              │
                                              └─ Server Components / Server Actions / Route Handlers / proxy.ts
```

The browser never sees the API URL, never holds a token in JavaScript-readable storage and never calls Express directly (this also sidesteps the backend's CORS allow-list, which only contains `http://localhost:3000` and the `Content-Type`/`Authorization` headers).
All server→API traffic goes through **one** module: `src/lib/server/api-client.ts` (`apiFetch`, `apiPaged`, `apiFetchRaw`).

## 2. Response envelope and error model

Success: `{ "success": true, "message": "...", "data": …, "meta": { "page", "limit", "total", "totalPages" } }`
Failure: `{ "success": false, "error": { "code", "message", "details": [{ "field", "message" }], "requestId" } }`

| Concern | Handling (file) |
|---|---|
| Envelope unwrap + runtime validation | `apiFetch` validates `data` against a zod schema from `src/schemas/api.ts`; a mismatch becomes `ApiError(502, INVALID_RESPONSE)` instead of rendering garbage |
| 4xx | message, `code` and field `details` are forwarded (`ApiError`), Server Actions map `details` onto form fields (`actions/_shared.ts › fromApiError`) |
| 5xx | logged on the server with the `requestId`; users only get *"The service had a problem. Please try again."* |
| Timeout / network | `AbortSignal.timeout(EMS_API_TIMEOUT_MS)`; becomes `ApiError(503, API_TIMEOUT | API_UNREACHABLE)` |
| 401 on a page | `getSession()` returns `null` → `requireSession()` redirects to `/login` |
| 403 on a page | `loadEmployee` / `requirePermission` redirect to `/unauthorized` |

## 3. Authentication flow

1. `POST /auth/login` accepts `{ email, password }` **or** `{ username, password }` (the login form field *Username or email* decides by the presence of `@`). The response carries `accessToken` (15 min) and `refreshToken` (7 days) **in the JSON body** (the backend sets no cookies).
2. The Server Action `loginAction` (`src/actions/auth.ts`) stores them in **HttpOnly, SameSite=Lax cookies** (`ems_at` = TTL − 60 s, `ems_rt` = 7 days; `Secure` in production) — `src/lib/server/cookies.ts`. Nothing is written to `localStorage`.
3. **Silent refresh:** `src/proxy.ts` runs before every protected request; with an expired access cookie and a valid refresh cookie it calls `POST /auth/refresh`, sets the new cookies on the response **and** rewrites the request's `cookie` header so the Server Components rendering that very request already use the new token.
4. The backend **rotates** refresh tokens and a *re-used* token revokes the whole family, so concurrent requests (prefetches!) must not refresh with the same token: `refreshOnce()` in `proxy.ts` de-duplicates with an in-process single-flight map (best effort for one instance — see `docs/deployment.md` for the multi-instance caveat).
5. Logout (`logoutAction`) revokes the refresh token (`POST /auth/logout`) and clears both cookies. A password change revokes **every** session on the backend, so `changePasswordAction` also clears cookies and redirects to `/login?changed=1`.
6. Self-registration: `POST /auth/register` (multipart: optional picture), `GET /auth/registration-options` (departments/designations; cached 5 min, tag `registration-options`), `GET /auth/username-available` (live check; the **only** public BFF API route besides `/api/health` and the secret-protected `/api/revalidate`).

## 4. Endpoint inventory actually used

| Area | Endpoints | Next.js layer |
|---|---|---|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `GET /auth/me`, `POST /auth/register`, `GET /auth/registration-options`, `GET /auth/username-available` | `lib/server/auth.ts`, `lib/server/session.ts`, `actions/auth.ts`, `proxy.ts` |
| Employees | `GET/POST /employees`, `GET/PUT/PATCH /employees/:id`, `POST …/deactivate`, `…/reactivate`, `GET/POST …/job-history`, `POST …/account`, `PUT …/role`, `GET/PUT …/picture`, `GET/PATCH /profile`, `PUT /profile/picture` | `lib/server/employees.ts`, `actions/employees.ts`, `actions/profile.ts`, `app/api/employees/**` |
| Departments / designations | `GET/POST /departments`, `GET/PUT/DELETE /departments/:id`, `POST …/activate`, `GET/POST /designations`, `GET/PUT /designations/:id` | `lib/server/departments.ts`, `actions/departments.ts` |
| Organization | `GET /org-chart`, `GET /org-chart/employees/:id/reporting-chain` | `lib/server/organization.ts` |
| Attendance | `POST /attendance/check-in`, `/check-out`, `GET /attendance/me`, `/attendance`, `/attendance/:id`, `PUT /attendance/:id`, `GET /attendance/summary`, `/attendance/reports/monthly`, `/calendar/attendance` | `lib/server/attendance.ts`, `actions/attendance.ts`, `app/api/attendance/today` |
| Leave | `GET /leave/types`, `/leave/balances`, `POST /leave/balances/adjust`, `GET/POST /leave/requests`, `…/:id`, `POST …/approve|reject|cancel`, `POST …/documents`, `GET …/documents/:docId`, `GET /leave/team`, `/leave/history/employees/:id`, `POST/PUT /leave/types` | `lib/server/leaves.ts`, `actions/leaves.ts`, `app/api/leave/**` |
| Holidays | `GET/POST /holidays`, `DELETE /holidays/:id`, `GET /weekly-offs`, `/calendar/leave` | `lib/server/holidays.ts`, `actions/holidays.ts` |
| Notifications | `GET /notifications`, `/notifications/unread-count`, `POST /notifications/read` | `lib/server/notifications.ts`, `actions/notifications.ts`, `app/api/notifications` |
| Dashboard / reports | `GET /dashboard`, `/reports/departments|designations|joiners-exits|leave-summary`, CSV via `?format=csv` | `lib/server/dashboard.ts`, `lib/server/reports.ts`, `app/api/reports/[name]/csv` |

## 5. Roles

`SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`. The UI mirror of the backend's `authorize(...)` rules lives in `src/constants/roles.ts` (`PERMISSIONS`, `can`). It is used to **hide** what a role cannot use; the pages (`requirePermission`), Server Actions (`secured`), Route Handlers (`protectedHandler`) re-check it, and the backend remains the final authority (a stale UI can never grant access).

## 6. Backend behaviours the frontend had to respect (not changed)

| Observation | How the frontend copes |
|---|---|
| `workLocation: null` on employee create/update → **HTTP 500** (NOT NULL column) | `toEmployeePayload` omits `workLocation` when empty; documented in the code and unit-tested (`tests/employee-payload.test.ts`) |
| `GET /dashboard` is **403** for `EMPLOYEE` | `getDashboard()` returns `null` on 403 and the dashboard shows a personal summary instead |
| No endpoints for education / experience / skills / certifications | kept **in the browser only** (`lib/client/qualifications.ts`) with a visible banner — not faked as server data |
| No `/users` endpoint | *Users & roles* is derived from the employee list (`account` block) |
| No WebSocket / SSE | notification badge **polls** every 30 s while the tab is visible (`hooks/useNotifications.ts`) |
| No date-range filter on `GET /employees` | the employees list offers search, department, status, sort and pagination; date ranges are offered on attendance, leave and reports where the backend supports them |
| Login limiter (10 attempts / 15 min) | a 429 is shown as the backend's message |
| Rotating refresh tokens | single-flight refresh in `proxy.ts` |
| Backend CORS allows only `localhost:3000` | irrelevant: the browser only talks to Next.js |

## 7. Verifying the integration

* Unit/server tests mock the API (`tests/api-client.test.ts`, `tests/actions.test.ts`, `tests/handler.test.ts`).
* End-to-end tests run against a **dedicated test backend and database** (`NODE_ENV=test`, port 4101, `ems_*_test` schema) — see the README *Testing* section. `scripts/e2e-seed.mjs` refuses to run against `:4100`.
* `GET /api/health` (`app/api/health/route.ts`) reports `{"status":"ok","upstream":"up"}` when Express answers.
