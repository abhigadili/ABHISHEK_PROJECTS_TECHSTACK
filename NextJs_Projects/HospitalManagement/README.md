# CityCare HMS — Hospital / Healthcare Management (Next.js 16)

A full-stack **Next.js 16 (App Router) + React 19 + TypeScript** frontend/BFF for the existing Node.js Hospital Management microservices. Every Next.js concept requested in the project brief is implemented through a real healthcare scenario (patients, doctors, appointments, hospitals, medical records, prescriptions, laboratory, billing, pharmacy, notifications) and is mapped to an exact file in [`NEXTJS_CONCEPTS_IMPLEMENTATION.md`](NEXTJS_CONCEPTS_IMPLEMENTATION.md).

> The Node.js backend (`../../NodeJS_Projects/HospitalManagement`) is **not modified**. This project owns **no database** — see [Database Architecture](NEXTJS_ARCHITECTURE.md#database-architecture) for why.

## Technology stack

| Area | Choice |
|---|---|
| Framework | Next.js **16.4.6** (App Router, Turbopack, `proxy.ts`), React **19.3**, TypeScript 5.9 (strict) |
| Server | Server Components, Server Actions (`'use server'`), Route Handlers (BFF), `server-only` modules, `unstable_cache` + fetch data cache |
| Client data | TanStack Query 5 (+ Axios), native `fetch` on the server |
| State | React state / `useReducer` / Context, Redux Toolkit + React Redux, Zustand (persist, subscribe), URL state |
| Forms | React Hook Form + Zod, Formik + Zod, plain `<form action>` + `useActionState`, `useReducer` form |
| UI libraries | MUI 9 (patients, doctors), Tailwind CSS 4 (dashboard, appointments, billing, profile), Radix UI (medical records, dialogs, tabs, menus), shadcn/ui-style components (laboratory, pharmacy, notifications) |
| Optimisation | `next/image` (+ remote patterns), `next/font` (Google *Inter* + local mono), Metadata API, `next/dynamic`, Suspense streaming |

## Prerequisites

* Node.js **≥ 20.9** (developed on 20.11.1), npm 10
* The Node.js Hospital backend running (gateway on **`http://localhost:30080`**) — start it from its folder with `docker compose up -d` (Kafka/Redis) then `scripts/start-all.sh`. It needs the local MySQL server.
* Internet access is *optional*: doctor avatars come from `ui-avatars.com` through `next/image`; if it is unreachable the UI falls back to initials badges.

## Installation

```bash
cd Documents/PROJECTS_TECKSTACK/NextJS_Projects/HospitalManagement
npm install
cp .env.example .env.local        # then fill in the values below
```

## Environment configuration (`.env.local`)

| Variable | Scope | Purpose |
|---|---|---|
| `NODE_API_BASE_URL` | **server only** | Gateway URL (verified: `http://localhost:30080`) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME` | public | Canonical URL / brand (no secrets) |
| `REVALIDATE_SECRET` | server only | Protects `POST /api/revalidate` (on-demand ISR webhook) |
| `PUBLIC_CATALOG_USERNAME` / `PUBLIC_CATALOG_PASSWORD` | server only | A **read-only PATIENT** login used only by server code to read hospitals/doctors for the public SSG/ISR pages (the gateway requires a JWT on every `/api/*` route except `/api/auth/*`). Create it once: `curl -X POST localhost:30080/api/auth/register -H 'content-type: application/json' -d '{"username":"hms-public-catalog","email":"public-catalog@hospital.local","password":"<strong password>"}'` |
| `COOKIE_SECURE` | server only | Set `true` behind HTTPS so auth cookies get the `Secure` flag |

`DATABASE_URL` / `AUTH_SECRET` from the brief's example are intentionally **absent**: there is no Next.js-owned database and the backend issues/validates the JWTs.

## Application startup

```bash
npm run dev                         # development server (Turbopack) -> http://localhost:3000
npm run build && npm run start -- -p 3200   # production build -> http://localhost:3200
npm run lint                        # ESLint (no tests by specification)
```

**Application URL:** `http://localhost:3200` (production run used for verification) or `http://localhost:3000` (dev). Port 3200 is the value of `NEXT_PUBLIC_APP_URL` in `.env.example`.

Public pages need the backend at **build time** (`generateStaticParams` pre-renders hospitals/doctors) — if it is down the build still succeeds and the pages render on first request (ISR).

## Backend API configuration

The browser never talks to the gateway. Server Components / Actions / Route Handlers call `NODE_API_BASE_URL` with the user's JWT (from an HttpOnly cookie); browser-side Axios calls go to the Next.js BFF pass-through `/api/backend/*`. Details, verified endpoints and gaps: [`API_INTEGRATION_DOCUMENTATION.md`](API_INTEGRATION_DOCUMENTATION.md).

## Available modules

| Module | Routes | Highlights |
|---|---|---|
| Public site | `/`, `/public/hospitals[/id]`, `/public/doctors[/id]`, `/public/info/…`, `/public/help/…` | SSG, ISR, `generateStaticParams`, dynamic metadata, `next/image` |
| Authentication | `/login`, `/register`, `/unauthorized`, `/access-denied` | Server Action login, HttpOnly cookies, silent refresh in `proxy.ts` |
| Dashboard | `/dashboard` | Parallel routes `@stats/@upcoming/@activity`, streaming |
| Patients | `/patients`, `/patients/register`, `/patients/[id]/…` | MUI, RHF+Zod wizard, nested layout, Server Actions |
| Doctors | `/doctors`, `/doctors/new`, `/doctors/[id]/…` | Redux Toolkit, Zustand shortlist, TanStack Query, `useFieldArray` schedule editor |
| Appointments | `/appointments`, `/appointments/book`, `/appointments/[id]`, `/appointments/calendar`, `/appointments/availability` | TanStack Query, optimistic cancel, **intercepting route modal** |
| Hospitals | `/hospitals`, `/hospitals/[id]`, `/hospitals/new` | Zustand (persisted) browser, departments |
| Medical records | `/medical-records` (alias `/records`), `/patients/[id]/medical-records` | Radix tabs, Suspense, server-component panels |
| Prescriptions | `/prescriptions`, `/prescriptions/generate`, `/prescriptions/[id]` | Formik + Zod, `FieldArray`, `useOptimistic`, download |
| Laboratory | `/laboratory`, `/laboratory/request`, `/laboratory/[id]`, `/laboratory/tests` | Infinite query, file upload/download |
| Billing | `/billing`, `/billing/invoices[/id]`, `/billing/generate`, `/billing/payments` | `useReducer` form, `useActionState`, sequential calls |
| Pharmacy | `/pharmacy`, `/pharmacy/orders[/id]`, `/pharmacy/medicines/[id]`, `/pharmacy/lookup` | Zustand filters, `next/dynamic` dialogs, infinite query |
| Notifications | `/notifications`, `/notifications/unread`, `/notifications/[id]` | Context + `useReducer`, inline Server Action, cookie read-state |
| Admin | `/admin/users`, `/profile` | Route group `(admin)`, optimistic toggle |

## Authentication details

* Login: `POST /api/auth/login` (backend) via the `loginAction` Server Action → `hms_at` (access, HttpOnly), `hms_rt` (refresh, HttpOnly, rotating), `hms_role` (non-sensitive routing hint).
* `proxy.ts` refreshes the access token silently (single-flight) before it expires; if refresh fails the user is sent to `/login?next=…`.
* **Not available in the backend** (and therefore not faked): MFA, OAuth 2.0 / social login, password reset, HttpOnly refresh cookie issued by the backend.
* Seed logins of the backend: `admin / Admin@123`; `doctor1`, `labstaff1`, `pharmacist1`, `billing1` / `Staff@123`. Patients self-register at `/register`.

## Build instructions

```bash
npm run build      # next build (type-checks, prerenders SSG/ISR pages)
npm run start      # next start
```

The build output lists every route as ○ static, ● SSG (`generateStaticParams`) or ƒ dynamic, plus the `Proxy` entry.

## Documentation index

| File | Content |
|---|---|
| [`NEXTJS_ARCHITECTURE.md`](NEXTJS_ARCHITECTURE.md) | Architecture, folders, data flow |
| [`NEXTJS_CONCEPTS_IMPLEMENTATION.md`](NEXTJS_CONCEPTS_IMPLEMENTATION.md) | Every concept → exact file/function |
| [`ROUTING_AND_RENDERING.md`](ROUTING_AND_RENDERING.md) | Routing + SSR/SSG/ISR/CSR/streaming decisions |
| [`DATA_FETCHING_AND_CACHING.md`](DATA_FETCHING_AND_CACHING.md) | Fetching, TanStack Query, cache tags/invalidation |
| [`SERVER_ACTIONS_AND_BACKEND.md`](SERVER_ACTIONS_AND_BACKEND.md) | Server Actions, Route Handlers, BFF |
| [`STATE_MANAGEMENT.md`](STATE_MANAGEMENT.md) | Which state lives where |
| [`API_INTEGRATION_DOCUMENTATION.md`](API_INTEGRATION_DOCUMENTATION.md) | Backend contract, verified URLs, gaps |
| [`BUSINESS_FLOWS.md`](BUSINESS_FLOWS.md) | Six end-to-end scenarios |
| [`IMPLEMENTATION_CHANGELOG.md`](IMPLEMENTATION_CHANGELOG.md) | What was built, limitations |
