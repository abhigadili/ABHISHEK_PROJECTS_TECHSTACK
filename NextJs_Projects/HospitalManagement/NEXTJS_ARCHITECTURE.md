# Next.js Architecture

## Overall application architecture

```
Browser ──────────────► Next.js 16 server (this project, port 3200/3000)
  │  HTML (RSC payload, streamed)        │
  │  client JS only for interactive      │  proxy.ts      – redirects, silent token refresh, rewrite, route-level access
  │  islands (Client Components)         │  Server Components / Server Actions / Route Handlers
  │                                      │  services/backend/*  (server-only, native fetch + data cache)
  │  Axios ─► /api/backend/* (BFF) ─────►│          │
  ▼                                      ▼          ▼
 HttpOnly cookies (JWT)             Node.js API gateway :30080 ──► 10 microservices ──► 10 MySQL databases (+Kafka, Redis)
```

* **Frontend + BFF only.** Business logic, validation rules, persistence and events stay in the existing Node.js services. Next.js adds rendering, caching, session handling (cookie authority), aggregation and file handling.
* **Server-first.** Pages are Server Components that fetch through `src/services/backend/*`; Client Components exist only where the browser is needed (forms, tables with local state, dialogs, charts of state).
* **Two data paths:** *server path* (Server Component/Action → `backendFetch` → gateway, JWT from cookie) and *client path* (TanStack Query → Axios → `/api/backend/*` BFF pass-through → gateway). The browser never sees a token or a service URL.
* **Cache Components are deliberately disabled** (`next.config.ts`): they forbid route-segment config (`revalidate`, `dynamic`, `dynamicParams`) and fetch-level `revalidate`, which the brief asks to demonstrate. The project instead uses the classic data cache (`fetch` options + `unstable_cache` + tags) and Full Route Cache (ISR) of Next.js 16.

## Folder structure

```
src/
├── proxy.ts                         Proxy (Next 16 name for Middleware)
├── app/
│   ├── layout.tsx · page.tsx · loading.tsx · error.tsx · global-error.tsx · not-found.tsx · robots.ts · sitemap.ts · icon.svg
│   ├── unauthorized/ · access-denied/
│   ├── (public)/public/…            SSG / ISR catalogue + catch-all info/help pages
│   ├── (auth)/login · register      auth route group with its own layout
│   ├── (dashboard)/                 authenticated shell (layout + template + loading + error + not-found)
│   │   ├── dashboard/ (@stats @upcoming @activity)      parallel routes
│   │   ├── patients/ doctors/ hospitals/ appointments/ (@modal) medical-records/ prescriptions/ laboratory/ billing/ pharmacy/ notifications/ profile/
│   │   └── (admin)/admin/users      admin route group
│   └── api/                         Route Handlers (BFF)
├── actions/                         Server Actions ('use server'), one file per domain
├── features/                        feature-specific components (client/server), hooks, forms
├── components/{ui,common,layouts,forms,providers}   shared UI (shadcn-style, Radix wrappers, providers)
├── services/{backend,api}           server-only API modules (fetch) · browser Axios modules + query keys
├── lib/{api,auth,config,actions,dashboard,doctors,notifications,utilities}
├── store/{redux,slices,zustand}     Redux Toolkit store/slices · Zustand stores
├── hooks/ · schemas/ (Zod) · types/ · constants/ · styles/ (fonts)
public/images/                       banners, document-preview illustration
```

The folder tree follows the brief's suggestion; `lib/database/`, `services/authentication/` and `services/api/` hold only what is needed (no database module exists — see below).

## App Router
File-system routing, nested layouts (`(dashboard)/layout.tsx` → `patients/[patientId]/layout.tsx` → page), route groups `(public)`, `(auth)`, `(dashboard)`, `(admin)`, parallel routes, intercepting routes, `loading/error/not-found/global-error/template/default`. Full inventory with files: [`ROUTING_AND_RENDERING.md`](ROUTING_AND_RENDERING.md).

## Server Components
Default for all `page.tsx`/`layout.tsx`. They are `async`, read `cookies()`, call `requireSession()/requirePermission()` (server-side authentication + authorization), fetch in parallel with `Promise.all` and pass **serialisable props** to Client Components. Server-only modules (`import 'server-only'`): `lib/config/env.ts`, `lib/api/backend.ts`, `lib/api/catalog.ts`, `lib/auth/session.ts`, `services/backend/*`, `lib/dashboard/metrics.ts`, `lib/actions/state.ts`.

## Client Components
Marked `'use client'` only when needed: `features/**` forms/boards, `components/layouts/DashboardShell.tsx`, providers, Radix/MUI wrappers. Server markup is passed *into* them as children/props (e.g. `features/records/RecordsTabs.tsx` receives three server-rendered panels).

## Routing architecture
`proxy.ts` is a convenience layer (redirects, silent refresh, rewrite `/records → /medical-records`, coarse role table). **Every** Server Component, Server Action and Route Handler re-checks authentication/authorization; the gateway and services enforce roles again (defence in depth).

## Rendering strategies
SSG (public info/help/hospital pages), ISR (hospital/doctor catalogue, sitemap), SSR (everything personal), CSR (interactive boards/search), streaming (dashboard slots, medical-record panels, NDJSON endpoint). Decision table: [`ROUTING_AND_RENDERING.md`](ROUTING_AND_RENDERING.md#rendering-decisions).

## Data fetching architecture
`services/backend/<service>.ts` (one module per microservice) → `lib/api/backend.ts` (`backendFetch`/`backendResponse`: bearer injection, timeout, centralised `ApiError`, cache options) on the server; `services/api/clientApis.ts` (Axios) + `services/queryKeys.ts` in the browser. See [`DATA_FETCHING_AND_CACHING.md`](DATA_FETCHING_AND_CACHING.md).

## Caching architecture
| Layer | Used for |
|---|---|
| Request memoisation | identical `GET` fetches in one render; `React.cache` for `getSession`, `getCurrentUser`, dashboard metrics |
| Data cache (`fetch next:{revalidate,tags}`) | hospitals, doctors, schedules, lab catalogue, medicines (non-personal reference data, **per-session key**) |
| `unstable_cache` | public catalogue for ISR pages (key independent of the rotating service token) |
| Full Route Cache | `/`, `/public/**` (static / ISR) |
| Router Cache | `experimental.staleTimes` (30 s dynamic, 180 s static) |
| Never cached | patient, medical-record, billing, appointment, lab-request, notification data (`cache: 'no-store'`) |

## State management architecture
Server state: server components + TanStack Query. Client state: `useState`/`useReducer`, Context (auth, notifications, theme), Redux Toolkit (doctors, appointment UI), Zustand (hospital, pharmacy, shortlist). URL state: search params (filters, pagination, dates). See [`STATE_MANAGEMENT.md`](STATE_MANAGEMENT.md).

## Authentication architecture
Next.js is the **cookie authority**: the backend returns `{accessToken, refreshToken}` in JSON; `lib/auth/session.ts` stores them in HttpOnly cookies. `proxy.ts` renews the access token (single-flight, rotating refresh tokens). `getCurrentUser()` validates against `/auth/me` in the dashboard layout; permissions come from `constants/permissions.ts`. Client UI receives only `{id, username, email, role}` via `AuthProvider`.

## Backend integration
Existing Node.js APIs for everything (ten services through the gateway). Next.js adds: the BFF pass-through (`api/backend/[...path]`), role-aware aggregation (`api/dashboard/*`), file endpoints (lab attachment upload/download, prescription download, CSV export), appointment verb adapter, preferences cookie, on-demand revalidation webhook, health. Table of "who does what" in [`SERVER_ACTIONS_AND_BACKEND.md`](SERVER_ACTIONS_AND_BACKEND.md).

## Database architecture
**No Next.js-owned database, no ORM.** The brief allows MySQL + Prisma/Drizzle "only for genuinely new Next.js-owned functionality". Every requirement is satisfied by the existing services; a new database would duplicate them, and the only candidates (UI preferences, notification read-state) are non-sensitive and live in cookies (`/api/preferences`, `hms_nread_<userId>`). Therefore: no `DATABASE_URL`, no migrations, no schema changes, no direct MySQL access from Next.js. If persistent Next-owned data is ever needed, add Prisma in `src/lib/database/` behind `server-only`.

## Styling architecture
Design tokens (CSS variables) in `src/app/globals.css` with light/dark themes (`.dark` class set before first paint by an inline script, toggled by `ThemeProvider` using `useSyncExternalStore`). Tailwind 4 consumes the tokens (`bg-surface`, `text-muted`, …), MUI gets a theme from the same palette (`MuiProvider`), Radix and shadcn-style components use the same classes — so four libraries look like one product. Libraries are never mixed inside one component. CSS Flexbox/Grid via Tailwind utilities; component-level styling via `cva` variants.

## Data flow (example: booking an appointment)
1. `/appointments/book` (Server Component) resolves the patient (`patientService.byUser`) → `BookingWizard` (client).
2. TanStack Query → Axios → `/api/backend/doctors`, `/appointments/availability` (BFF attaches JWT) → gateway.
3. Submit → `bookAppointmentAction` (Server Action): `authorize('appointments:book')` → Zod parse → `appointmentService.book` → `updateTag/revalidatePath` → returns `ActionState`.
4. Client invalidates `['appointments']` queries; backend Kafka creates a bill + notification asynchronously.
