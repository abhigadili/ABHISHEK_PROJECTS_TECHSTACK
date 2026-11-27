# EMS-React — Employee Management System (React + TypeScript)

A complete React single-page application for the existing **EMS-ExpressJS** backend. It is also a hands-on React learning
project: every concept is implemented in a real screen (or a clearly-labelled lab example) and documented in
[`docs/react-concepts/`](docs/react-concepts/), with a concept → implementation → test map in
[`EMS-REACT-CONCEPT-MAPPING.md`](docs/react-concepts/EMS-REACT-CONCEPT-MAPPING.md).

* Frontend only. **No new backend, no new database, backend not modified.** Express stays the single source of truth for
  authentication, authorisation, validation and persistence.
* Independent of any other frontend project.

## Technology stack

| Layer | Technology (installed version) |
|---|---|
| UI library | React **19.3** (function components + Hooks) |
| Language | TypeScript **5.7**, `strict: true` |
| Build tool | Vite **6.4** |
| Routing | React Router **7.18** (data router: loaders, actions, lazy routes) |
| Server state | Redux Toolkit **2.14** — RTK Query (`createApi` + `fetchBaseQuery`) |
| Client state | Redux Toolkit slices/thunks/selectors + Context API + local Hooks |
| HTTP | Axios **1.21** (interceptors, multipart, blobs, cancellation) |
| Forms | React Hook Form **7.91** + Zod **3.25** |
| UI kit | Material UI **6.5** + SCSS |
| Charts | Recharts **2.15** |
| Unit tests | Vitest **3.2** + React Testing Library **16** + msw **2** |
| E2E tests | Playwright **1.65** (real backend, isolated test DB) |

## Prerequisites

* Node.js ≥ 20.11 (developed on 20.11.1; React 19 / Vite 6 / Vitest 3 all support it). npm ≥ 10.
* The **EMS-ExpressJS** backend at `~/Documents/NodeJS_Projects/EMS-ExpressJS` with MySQL running and its `.env` configured.
* Google Chrome (for Playwright; the bundled Chromium is not offered for every Linux release).

## Installation

```bash
cd ~/Documents/React_Projects/EMS-React
npm install
cp .env.example .env        # already present after the first setup; edit if your backend is elsewhere
```

## Environment configuration

`.env` holds **browser-visible** settings only (every `VITE_*` value is bundled into the client — never put secrets here):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Path the SPA calls. Relative = same origin as the page, served through the Vite proxy. |
| `VITE_BACKEND_URL` | `http://localhost:4100` | Where the Vite dev/preview **proxy** forwards `/api`. |
| `VITE_APP_NAME` | `EMS` | Display name. |

Why a proxy? The backend's CORS allow-list contains only `http://localhost:3000` and only the `Content-Type`/`Authorization`
headers. Proxying `/api` makes browser calls same-origin, so no backend change is needed. For production put the SPA and
`/api` behind one reverse proxy (nginx/Caddy) the same way — see **Production build**.

## Backend integration

* Project: `~/Documents/NodeJS_Projects/EMS-ExpressJS` (Express 5, MySQL, JWT). Swagger UI: `http://localhost:4100/api-docs`.
* **API base URL:** `http://localhost:4100/api/v1` (the SPA reaches it as `/api/v1` through the proxy).
* Full endpoint inventory, roles, limitations and missing APIs: [`docs/backend-api-integration.md`](docs/backend-api-integration.md).
* **Authentication:** JWT Bearer **access token** (15 min, kept in memory only) + rotating **refresh token** (7 days, in
  `localStorage` because the backend returns it in the JSON body — there is no HttpOnly cookie). On a 401 the Axios interceptor and
  the RTK Query base query share **one** single-flight refresh, replay the request, and log the user out if refresh fails.
* **Roles:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`. The UI hides what a role can't use; the backend enforces everything.

### Start the backend (separate terminal)

```bash
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
npm start            # production mode → http://localhost:4100   (or: npm run dev for nodemon)
# first run only: create the initial SUPER_ADMIN (credentials from env, never from source)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' npm run admin:create
```

### Start the React app (its own terminal)

```bash
cd ~/Documents/React_Projects/EMS-React
npm run dev          # → http://localhost:5173  (proxies /api → http://localhost:4100)
```

Sign in with the SUPER_ADMIN you created, then create departments, designations and employees (give employees logins to
try the other roles).

## Features

| Module | Highlights (all backed by real endpoints) |
|---|---|
| Authentication | Self-registration (`/register`), login by username or email, logout, silent token refresh, forgot/reset password, change password, session restore on reload, sign-out of all devices |
| Dashboard | KPI cards, headcount/attendance/leave charts (Recharts), birthdays, anniversaries; personal summary for employees |
| Employees | Paged/sorted/filterable list (filters live in the URL), table + card views, 5-step create/edit form with dynamic rows, details, profile tab, job history, promotions/transfers, (de)activation, profile-picture upload |
| Departments / designations | CRUD, head assignment, activation switch via a route **action**, department detail with employees and teams, job level/grade |
| Organization | Org chart generated from the reporting hierarchy: expand/collapse, search + reveal, department filter, selection highlight, reporting chain, direct reports |
| Attendance | Check-in/out, history with date-range/status filters, details, admin correction (audited), monthly calendar, summary, monthly and department reports + CSV |
| Leave | Types, balances, apply (with document), history, details, cancel, manager approvals (optimistic UI), HR administration (types, balance adjustments), team calendar |
| Holidays | List, calendar, add/edit/delete, weekly offs |
| Notifications | Header badge (polled), menu, list, mark read / mark all read |
| Reports | Headcount, joiners/leavers, leave balances (virtualised), leave summary, employee directory export, server CSV |
| Users & roles | Create logins, change roles (SUPER_ADMIN), activate/deactivate |
| Settings / profile | Theme, change password, edit own contact data, avatar |
| **React Lab** | Isolated demos: lifecycle, every Hook, controlled/uncontrolled, HOC/render-props/compound, keys/memo/portals/error boundaries |

Not supported by the backend (documented, not faked): education / experience / skills storage (kept in **this browser only**,
with a visible banner), a `/users` endpoint (composed from the employee endpoints), WebSocket notifications (polling is used).

## Folder structure

```text
src/
├── main.tsx · App.tsx
├── app/            router/ (routes, loaders, actions) · providers/ (AppProviders) · store/ (configureStore, typed hooks)
├── api/            httpClient (Axios + interceptors) · tokenStore · errors
├── services/       authApi, employeeApi, departmentApi, designationApi, attendanceApi, leaveApi, organizationApi,
│                   notificationApi, dashboardApi, reportApi, profileApi, qualificationsStore
├── store/          slices/ · selectors/ · api/ (RTK Query: emsApi, baseQuery) · thunk.ts
├── contexts/       Authentication · User · Theme · Notification · AppConfig
├── hooks/          useAuth, useEmployees, useDepartments, useAttendance, useLeave, useOrganization, useNotifications,
│                   usePagination, useDebounce, useLocalStorage, useModal, usePermissions, useApi, useFormValidation, …
├── schemas/        Zod schemas (auth, employee, organization, leave/attendance)
├── components/     common/ · layout/ · forms/ · tables/ · dialogs/
├── features/       auth, dashboard, employees, departments, designations, organization, attendance, leaves,
│                   holidays, notifications, reports, users, profile, settings, lab
├── constants/ · types/ · utils/ · styles/ · test/
e2e/                Playwright specs
docs/               backend-api-integration.md · react-concepts/ (30 guides + concept mapping)
scripts/            e2e-seed.mjs (seeds the isolated TEST backend)
```

## State management approach (who owns what)

| Kind of state | Owner | Examples |
|---|---|---|
| Request/response **server state** (cache, invalidation, dedupe) | **RTK Query** (`store/api/emsApi.ts`) | employees, departments, leave, holidays, notification list, reports |
| Cross-feature **client state** and command workflows | **Redux slices + thunks** | session (`authSlice`), check-in/out workflow, dashboard snapshot, unread badge, normalised employee directory for pickers, department filter, selection |
| **Static / slow-changing app-wide values** | **Context** | theme, app config, toasts, current-user presentation data, auth façade |
| **Component-local** state | `useState` / `useReducer` / `useRef` | dialogs, form steps, search-box text, hover |
| **URL** state | React Router search params | employee filters, pagination, attendance range |

Rule of thumb: *the same data is never stored in two places.* Details and the Context-vs-Redux decision guide:
[`04-state-and-state-management.md`](docs/react-concepts/04-state-and-state-management.md), [`08-context-api.md`](docs/react-concepts/08-context-api.md).

## Testing

```bash
npm test             # Vitest: unit + component + hook + service + store + route tests (msw mocks the HTTP layer)
npm run test:watch
npm run lint && npm run typecheck
```

### End-to-end (Playwright, real backend, isolated data)

E2E must **never** run against the development database. Use the backend's dedicated test database:

```bash
# 1. in EMS-ExpressJS: (re)create the isolated test schema and an admin that only exists there
cd ~/Documents/NodeJS_Projects/EMS-ExpressJS
NODE_ENV=test node -e "require('./tests/globalSetup')()"
NODE_ENV=test ADMIN_EMAIL=e2e.admin@ems.example ADMIN_PASSWORD='<strong password>' node scripts/create-admin.js
NODE_ENV=test PORT=4101 LOGIN_RATE_LIMIT_MAX=1000 API_RATE_LIMIT_MAX=100000 node src/server.js &

# 2. in EMS-React: seed a small org through the API, then run the suite (Vite starts itself on :5174 → proxies to :4101)
cd ~/Documents/React_Projects/EMS-React
export E2E_ADMIN_EMAIL=e2e.admin@ems.example E2E_ADMIN_PASSWORD='<same>' E2E_USER_PASSWORD='<strong password for seeded users>'
npm run e2e:seed
E2E_CHANNEL=chrome npm run e2e
```

`E2E_CHANNEL=chrome` uses the installed Google Chrome (Playwright's bundled Chromium is unsupported on some Ubuntu releases;
do **not** run `playwright install` just to work around it). Credentials come from the environment — nothing is committed.
`e2e/refresh.spec.ts` additionally needs a backend started with `JWT_ACCESS_TTL=4s` and `E2E_SHORT_TTL=1`; it is skipped otherwise.

## Production build

```bash
npm run build        # tsc -b (type-check) then vite build → dist/
npm run preview      # serves dist/ on :5173 with the same /api proxy
```

`dist/` is static. Serve it behind a reverse proxy that (a) falls back to `index.html` for unknown paths (client-side routing)
and (b) forwards `/api/` to the Express server — e.g. nginx: `location /api/ { proxy_pass http://127.0.0.1:4100; }` and
`location / { try_files $uri /index.html; }`. Vendor code is split into `react`, `mui`, `charts` and `state` chunks and every page
is lazy-loaded. There are no mock/fixture data paths in the production bundle (fixtures live only under `src/test/`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Network error toasts, `ECONNREFUSED` in the Vite log | Backend not running on `VITE_BACKEND_URL`. Start it (`npm start` in EMS-ExpressJS). |
| Login says *Too many requests* | Backend login limiter: 10 attempts / 15 min. Wait, or restart the backend. |
| Immediately signed out after login | Clock skew / backend restarted with a different `JWT_ACCESS_SECRET` → sign in again. |
| `403` toast on an action | Your role lacks permission; the backend decided (the UI hides most such buttons). |
| Employee form → "Work location" etc. rejected | Server validation message is shown under the field; fix and resubmit. |
| Education/experience missing on another browser | By design: no backend endpoint yet; stored per browser. |
| Vitest fails with `ERR_REQUIRE_ESM` | jsdom ≥ 27 needs Node ≥ 20.19. This project pins `jsdom@26`. |
| Playwright: *chromium not supported* | Run with `E2E_CHANNEL=chrome`. |
| Blank page after deploy | Server doesn't fall back to `index.html` for client-side routes. |
