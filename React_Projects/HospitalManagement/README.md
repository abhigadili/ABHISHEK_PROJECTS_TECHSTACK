# Hospital Management – React Frontend

A TypeScript React 19 application for the **existing Node.js Hospital Management microservices** (`Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement`).
It covers all ten backend services (patients, doctors, appointments, hospitals, medical records, prescriptions, laboratory, billing, pharmacy, notifications), the six business scenarios of the specification and – deliberately – a wide cross-section of the React ecosystem, each concept living in a module where it makes practical sense.

> **No mock data.** Every figure, table and form talks to the real backend through its API gateway. Where the backend has no endpoint for something (e.g. a read flag on notifications, MFA, OAuth 2, facility inventory) the UI says so and the gap is listed in [`API_INTEGRATION_DOCUMENTATION.md`](./API_INTEGRATION_DOCUMENTATION.md#unavailable-or-missing-apis).

## Contents
1. [Technology stack](#technology-stack) · 2. [Prerequisites](#prerequisites) · 3. [Installation](#installation) · 4. [Environment configuration](#environment-configuration) · 5. [Starting the backend](#starting-the-backend) · 6. [Starting the frontend](#starting-the-frontend) · 7. [Application URL](#application-url) · 8. [Backend API configuration](#backend-api-configuration) · 9. [Modules](#available-modules) · 10. [Authentication](#authentication-details) · 11. [Build](#build-instructions) · 12. [Documentation set](#documentation-set)

## Technology stack

| Area | Used |
|---|---|
| Core | React 19.3, TypeScript 5.8 (strict), Vite 6.4, ES2022, HTML5, CSS3 |
| Routing | React Router DOM 7 – `BrowserRouter`, `Routes`/`Route`, nested + dynamic + layout routes, `useNavigate/useLocation/useParams/useSearchParams`, lazy routes |
| Server state | TanStack Query 5 (queries, mutations, infinite queries, `useQueries`, optimistic updates, defaults, prefetch, devtools in dev) |
| Client state | `useState`, `useReducer`, Context API, Redux Toolkit 2 + React Redux 9, Zustand 5 |
| HTTP | Axios (instance, interceptors, retry, cancellation) **and** the Fetch API (medical records) |
| Forms | React Hook Form 7, Formik 2, Zod 3, Yup 1, controlled / uncontrolled / `useReducer` / React 19 `useActionState` forms |
| UI | MUI 6 (patients, doctors, hospitals), Tailwind CSS 3 (appointments, billing, notifications, dashboard, shell), Radix UI + CSS Modules (medical records), shadcn/ui-style components (laboratory, pharmacy, prescriptions) |
| Misc | dayjs, lucide-react, react-hot-toast, @tanstack/react-virtual |

## Prerequisites
* Node.js ≥ 20.11 and npm ≥ 10 (developed on Node 20.11.1 – hence Vite 6 / MUI 6, which are the newest majors that run on it).
* The **backend must be running** (see below). The frontend does not start, mock or replace any backend service.

## Installation
```bash
cd ~/Documents/PROJECTS_TECKSTACK/React_Projects/HospitalManagement
npm install
cp .env.example .env        # already present on this machine
```

## Environment configuration
`.env.example` (copy to `.env`):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:30080` | Gateway of the Node.js backend (verified; **one** gateway fronts all ten services, there are no per-service URLs) |
| `VITE_USE_PROXY` | `true` | `true`: the browser calls its own origin (`/api/...`) and the Vite dev/preview server proxies to `VITE_API_BASE_URL` – no CORS involved. `false`: the browser calls the gateway directly (the gateway allows any origin) |
| `VITE_API_TIMEOUT_MS` | `20000` | Axios/Fetch timeout |
| `VITE_IDLE_LOGOUT_MINUTES` | `30` | Automatic sign-out after inactivity |

No secrets are stored in the frontend. `.env` is git-ignored.

## Starting the backend
(documented separately because it is a different project; nothing in it was changed)
```bash
cd ~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement
docker compose up -d            # Kafka :39092, Redis :36379
./scripts/start-all.sh          # 10 services + gateway on :30080
# stop: ./scripts/stop-all.sh ; docker compose down
```
MySQL (port 3306) must be reachable with the credentials in the backend's git-ignored `.env`.

## Starting the frontend
```bash
npm run dev        # development server with HMR  -> http://localhost:5180
npm run build      # type-check (tsc -b) + production build into dist/
npm run preview    # serve dist/ on http://localhost:5181 (same /api proxy)
```
The frontend runs independently of the backend process – without a backend the UI loads and shows connection errors with retry buttons.

## Application URL
* Development: **http://localhost:5180** (Vite picks the next free port if 5180 is busy)
* Preview of the production build: **http://localhost:5181**

## Backend API configuration
* Gateway: `http://localhost:30080` – verified operational (all ten services answer through it). Service ports 30101-30110 and gRPC ports are internal and never used by the frontend.
* All calls go through `src/services/axios/client.ts` (Axios instance, `API_PREFIX = <origin>/api`) or `src/services/api/fetchClient.ts` (Fetch).
* Full inventory (endpoints, payloads, responses, roles, what is live and what is missing): [`API_INTEGRATION_DOCUMENTATION.md`](./API_INTEGRATION_DOCUMENTATION.md).

## Available modules

| Module | Routes | UI library | Highlights |
|---|---|---|---|
| Authentication | `/login`, `/register`, `/access-denied`, `/unauthorized` | Tailwind | JWT + rotating refresh token, RBAC/permissions, idle logout |
| Dashboard | `/dashboard` | Tailwind | role-aware live figures via `Promise.allSettled` + timeouts |
| Patients | `/patients`, `/patients/new`, `/patients/:id/*`, `/profile` | MUI | multi-step registration (`useState` + Zod), Formik + Zod edit, routed tabs |
| Doctors | `/doctors`, `/doctors/:id/{schedule,availability,appointments}` | MUI | Redux Toolkit filters, React.memo cards, RHF `useFieldArray` schedule editor, Formik + Yup form |
| Appointments | `/appointments`, `/book`, `/calendar`, `/availability`, `/:id`, `/:id/reschedule` | Tailwind | dependent + parallel queries, optimistic cancel, compound `AppointmentCard`, lazy calendar |
| Hospitals | `/hospitals`, `/hospitals/:id/{departments,facilities}` | MUI | Zustand UI store, Context "active hospital", custom validation |
| Medical records | `/records`, `/records/patients/:id`, `/records/entries/:id`, `/records/documents` | Radix + CSS Modules | Fetch API, virtualised timeline, blob download/upload |
| Prescriptions | `/prescriptions`, `/new`, `/history/:patientId`, `/:id` | Tailwind/shadcn | Formik + Zod + `FieldArray`, compound `PrescriptionView`, print/download |
| Laboratory | `/lab/tests`, `/lab/requests[/new|/:id]`, `/lab/reports`, `/lab/history` | shadcn/ui | RHF + Zod dynamic rows, pagination + infinite queries, report upload/download |
| Billing | `/billing`, `/invoices[/:id]`, `/generate`, `/payments` | Tailwind | Redux Toolkit slice + sequential thunk, `useReducer` forms, optimistic payment |
| Pharmacy | `/pharmacy/medicines[/:id]`, `/availability`, `/orders` | shadcn/ui | Zustand store, debounce + throttle, infinite orders, optimistic restock |
| Notifications | `/notifications`, `/unread`, `/:id` | Tailwind | Context + polling, React 19 `useActionState` form |
| System (ADMIN) | `/system/cache`, `/system/profiler` | Tailwind | TanStack cache inspector, React `<Profiler>` results |

## Authentication details
* Accounts live in the backend's Hospital Service. Login: `POST /api/auth/login` (`username` + `password`) → 15-minute HS256 access token + opaque 7-day **rotating** refresh token (reuse revokes the whole family).
* The access token is kept **only in memory**; the refresh token in `sessionStorage` (tab-scoped, cleared when the tab closes) because the backend returns it in the JSON body and sets no HttpOnly cookie. Never `localStorage`.
* One shared single-flight refresh handles concurrent 401s for both Axios and Fetch; refresh failure ⇒ session-expired logout. A renewal timer refreshes one minute before expiry.
* Roles: `ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF` → routes guarded by HOCs (`withAuth/withRoles/withPermission`), UI by `<Can>`/`useCan`.
* Not offered because the backend has no endpoints: forgot/reset password, MFA, OAuth 2.0, social login.
* Development accounts seeded by the backend (see the backend's README; change them in any shared environment): `admin`, `doctor1`, `labstaff1`, `pharmacist1`, `billing1`. Patients self-register at `/register`.

## Build instructions
```bash
npm run build      # tsc -b && vite build  -> dist/ (vendor chunks: react, router, tanstack, mui, radix, forms, state)
npm run preview    # http://localhost:5181
```
There is deliberately **no test runner and no lint/CI tooling** in this project (specification requirement).

## Documentation set
| File | Content |
|---|---|
| [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md) | folder structure, layers, routing, state, API, query, auth, styling, data flow |
| [`REACT_CONCEPTS_IMPLEMENTATION.md`](./REACT_CONCEPTS_IMPLEMENTATION.md) | every React concept → module, exact file, component/hook, how it works |
| [`API_INTEGRATION_DOCUMENTATION.md`](./API_INTEGRATION_DOCUMENTATION.md) | verified backend contracts, mapping to modules, missing APIs |
| [`BUSINESS_FLOWS.md`](./BUSINESS_FLOWS.md) | the six end-to-end scenarios step by step |
| [`IMPLEMENTATION_CHANGELOG.md`](./IMPLEMENTATION_CHANGELOG.md) | what was built, files, limitations |
