# Project Architecture

## 1. Overall frontend architecture

```
┌──────────────────────────────── Browser (React 19 + TypeScript, Vite) ────────────────────────────────┐
│  main.tsx → App → ErrorBoundary → AppProviders ─┬─ Redux store         (UI workflow state)            │
│                                                 ├─ QueryClientProvider (all server state)             │
│                                                 ├─ ThemeProvider       (CSS vars + Tailwind dark + MUI)│
│                                                 ├─ LocalizationProvider(dayjs, MUI date pickers)      │
│                                                 ├─ TooltipProvider     (Radix)                        │
│                                                 └─ AuthProvider        (session, RBAC, token renewal) │
│            → BrowserRouter → <Routes> ─┬─ AuthLayout   (login, register)                              │
│                                        └─ ProtectedLayout(AppLayout: sidebar + header + <Outlet>)     │
│                                              └─ lazy feature pages (route-level code splitting)       │
│                                                                                                       │
│  feature hooks (useQuery/useMutation) → endpoint modules → Axios instance / Fetch client              │
│                                          (interceptors: bearer, correlation id, 401→refresh, retry)   │
└───────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                │ HTTP /api/*  (Vite proxy in dev/preview, or direct)
                                   ┌────────────▼────────────┐
                                   │ API gateway :30080      │  JWT validation, role rules, rate limit
                                   └────────────┬────────────┘
        Hospital(+identity) · Patient · Doctor · Appointment · Medical Records · Prescription ·
        Laboratory · Billing · Pharmacy · Notification   (existing Node.js backend – untouched)
```

Principles applied everywhere:
* **Server state lives in TanStack Query only.** Redux/Zustand/Context hold *client* state (filters, selections, layout, preferences, session) – never a copy of API data.
* **UI components never call Axios/Fetch directly.** They use feature hooks (`features/*/hooks`) which use endpoint modules (`services/endpoints`).
* **Types come from the real contracts** (`src/types/*`, derived from the backend's OpenAPI and live responses); no `any` in application code (the only escapes are narrow, commented casts for library generics).
* **Permissions mirror the backend** (`src/constants/permissions.ts`); the backend remains the authority.

## 2. Folder structure

```
HospitalManagement/                       (Documents/PROJECTS_TECKSTACK/React_Projects/HospitalManagement)
├── index.html  vite.config.ts  tailwind.config.js  postcss.config.js  tsconfig*.json  package.json
├── .env.example  .env (git-ignored)  README.md  PROJECT_ARCHITECTURE.md  REACT_CONCEPTS_IMPLEMENTATION.md
├── API_INTEGRATION_DOCUMENTATION.md  BUSINESS_FLOWS.md  IMPLEMENTATION_CHANGELOG.md
├── public/favicon.svg
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx            BrowserRouter + providers + root ErrorBoundary
    │   ├── router.tsx         <Routes>, lazy pages, HOC guards
    │   ├── store.ts           Redux Toolkit store (QueryClient injected as thunk `extra`)
    │   ├── queryClient.ts     QueryClient, Query/Mutation caches, query + mutation defaults
    │   └── providers/AppProviders.tsx
    ├── components/
    │   ├── ui/                shadcn/ui-style primitives (Radix + Tailwind + cva): button, input, dialog, tabs, select, …
    │   ├── common/            QueryBoundary, PageHeader, StatCard, StatusBadge (factory), SearchInput, Pagination, PatientPicker, …
    │   ├── forms/             FileDropzone, FormikFields
    │   ├── tables/            DataTable (render props), VirtualList (virtualisation)
    │   ├── dialogs/           Modal (portal), ConfirmDialog (imperative handle)
    │   ├── layouts/           Sidebar, Header, Breadcrumbs, TopProgress, NetworkBanner
    │   ├── hoc/               withAccess.tsx (withAuth / withRoles / withPermission / withPublicOnly)
    │   └── error-boundaries/  ErrorBoundary.tsx
    ├── layouts/               AppLayout.tsx, AuthLayout.tsx (layout routes)
    ├── features/              ← one folder per backend service / business area
    │   ├── authentication/    pages (Login, access pages), hooks/useCurrentIdentity
    │   ├── patients/          pages, components (PatientRow, PatientDetailGrid, MuiSimpleTable), hooks/usePatients
    │   ├── doctors/           pages (list, details, tabs, form), components, hooks/useDoctors
    │   ├── appointments/      pages, components (AppointmentCard, SlotPicker, CalendarMonth), hooks, constants
    │   ├── hospitals/         pages, components, hooks/useHospitals
    │   ├── medical-records/   pages, components, hooks, records.module.css
    │   ├── prescriptions/     pages, components/PrescriptionView, hooks, utils
    │   ├── laboratory/        pages, hooks/useLab, constants
    │   ├── billing/           pages, components/PayDialog, hooks/useBilling
    │   ├── pharmacy/          pages, components, hooks/usePharmacy, utils/stock
    │   ├── notifications/     pages, components/SendNotificationDialog, hooks
    │   ├── dashboard/         pages/DashboardPage, hooks/useDashboardStats
    │   └── system/            pages/CacheMonitorPage, ProfilerPage
    ├── contexts/              AuthContext, ThemeContext, HospitalContext, NotificationsContext
    ├── hooks/                 useDebounce, useThrottle, useUrlState, useOnlineStatus, useIdleTimer, useFileDownload, …
    ├── services/
    │   ├── axios/             client.ts, refresh.ts, tokenStore.ts, errors.ts, authEvents.ts
    │   ├── api/               http.ts (typed helpers), fetchClient.ts (Fetch API client)
    │   ├── endpoints/         one module per backend service
    │   └── queryKeys.ts       query-key factories
    ├── store/
    │   ├── slices/            doctorFiltersSlice, billingUiSlice, layoutSlice (Redux Toolkit)
    │   ├── redux/             typed hooks, RootState/AppDispatch/thunk config types
    │   └── zustand/           hospitalStore, pharmacyStore
    ├── schemas/               Zod / Yup / custom validation schemas
    ├── types/                 API + domain types (per service) + barrel
    ├── utils/                 format, jwt, promise (race/retry/allSettled/sequence), slots, zodForm, profilerStore, …
    ├── constants/             config (env), permissions, navigation
    └── styles/global.css      design tokens (light/dark), shared reset, print rules
```
Deviations from the suggested tree: `layouts/` holds the two layout *routes* while reusable pieces are in `components/layouts/`; `routes/` and `assets/` were dropped because the routing table is `app/router.tsx` and no static assets are needed; the `components/ui` folder exists for the shadcn/ui primitives.

## 3. Feature-based architecture
Each folder in `src/features/<area>` contains **everything that area needs**: `pages/` (route components), `components/` (area-specific UI), `hooks/` (queries + mutations + view logic) and, when needed, constants/utils/CSS. Rules:
* A feature may import `components/*`, `hooks/*`, `services/*`, `contexts/*`, `store/*`, `schemas/*`, `types`, `utils` and `constants`.
* Features import from each other **only through hooks/components that are deliberately shared** (e.g. appointments use `usePatient` from patients; prescriptions use `useCurrentDoctor` from authentication). Pages are never imported across features.
* Nothing in `services/` or `store/` imports from a feature (exception: none).

## 4. Component architecture
| Layer | Examples | Responsibility |
|---|---|---|
| Pages (smart containers) | `PatientListPage`, `BookAppointmentPage`, `InvoiceListPage` | read URL state, call feature hooks, compose UI, own page-level state |
| Feature components | `DoctorCard`, `PatientRow`, `MedicineRow`, `EntryRow` (all `React.memo`), `PayDialog`, `ScheduleEditor` | presentational where possible, props in / callbacks out |
| Shared composites | `QueryBoundary` (render prop), `DataTable` (render props), `VirtualList`, `SearchInput` (forwardRef + useImperativeHandle), `FileDropzone`, `PatientPicker`, `ConfirmDialog` | reusable behaviour with no domain knowledge |
| Compound components | `AppointmentCard.*`, `PrescriptionView.*` | share data through context, caller arranges sub-parts |
| Primitives | `components/ui/*` (shadcn/ui), MUI components | styling-library building blocks |
| HOCs | `withAuth`, `withRoles`, `withPermission`, `withPublicOnly` | cross-cutting route/permission behaviour |
| Factories | `createStatusBadge()` (`components/common/StatusBadge.tsx`) | one definition → typed badge components per status enum |

Error handling in the component tree: a root `ErrorBoundary` in `App.tsx`, a pathname-keyed boundary around the routed content in `AppLayout` (the shell survives a crashing page and resets on navigation), `QueryBoundary` for loading/error/empty per data view.

## 5. Routing architecture (`src/app/router.tsx`)
* `BrowserRouter` + declarative `<Routes>/<Route>`.
* **Layout routes:** `AuthLayout` (public) and `ProtectedLayout = withAuth(AppLayout)` (sidebar/header/breadcrumbs, `<Suspense>` + `ErrorBoundary` around `<Outlet>`).
* **Nested routes with Outlet context:** `/patients/:patientId` and `/doctors/:doctorId` are layout routes with tab children (`medical-history`, `appointments`, … / `schedule`, `availability`, …); the loaded record is passed to the tab pages with `<Outlet context>` / `useOutletContext`.
* **Dynamic routes + params:** `:patientId`, `:doctorId`, `:appointmentId`, `:hospitalId`, `:entryId`, `:prescriptionId`, `:requestId`, `:billId`, `:medicineId`, `:notificationId`.
* **Query parameters:** `useUrlState` (`useSearchParams`) keeps search/filter/sort/page in the URL for patients, appointments, lab requests, notifications; the booking page reads `?doctorId=&date=&time=`.
* **Protection:** `withAuth` (login required), `withRoles`, `withPermission(permission)`; unauthenticated → `/login` with `state.from`, forbidden → `/access-denied`; `withPublicOnly` bounces signed-in users away from `/login`.
* **Lazy routes:** every page is `React.lazy`; the production build has one chunk per page plus vendor chunks (`vite.config.ts → manualChunks`).
* Catch-all `*` → `NotFoundPage`.

## 6. State management architecture

| Kind of state | Tool | Where |
|---|---|---|
| Server data (everything from the API) | **TanStack Query** | `features/*/hooks`, `src/app/queryClient.ts` |
| Session / auth | `useReducer` inside **Context** (state and actions split into two contexts) | `contexts/AuthContext.tsx` |
| Theme | Context | `contexts/ThemeContext.tsx` |
| Active hospital | Context (persisted) | `contexts/HospitalContext.tsx` |
| Notification centre (poll feed + local read state) | Context + Query | `contexts/NotificationsContext.tsx` |
| Doctor directory filters/sort/page/compare tray | **Redux Toolkit** slice + memoised selectors | `store/slices/doctorFiltersSlice.ts` |
| Billing filters, payable basket, settlement log, sequential settlement thunk | **Redux Toolkit** slice + `createAsyncThunk` | `store/slices/billingUiSlice.ts` |
| Sidebar collapsed / mobile drawer | Redux Toolkit | `store/slices/layoutSlice.ts` |
| Hospital directory view/filters/compare | **Zustand** (persisted preferences) | `store/zustand/hospitalStore.ts` |
| Pharmacy catalogue search/sort/stock filter/pinned medicines | **Zustand** (persisted pins) | `store/zustand/pharmacyStore.ts` |
| Wizard / form state | `useState`, `useReducer`, Formik, React Hook Form | pages (see concept map) |
| Shareable view state (filters, pages) | URL (`useSearchParams`) | `hooks/useUrlState.ts` |

## 7. API integration architecture
* **Environment-driven base URL** (`src/constants/config.ts`): `VITE_API_BASE_URL`, `VITE_USE_PROXY`, `VITE_API_TIMEOUT_MS`.
* **One Axios instance** (`services/axios/client.ts`): request interceptor adds `Authorization` and `X-Correlation-Id`; response interceptor performs GET retry with back-off (network/502/503/504), 401 → single-flight refresh + replay, 403 → event, and converts every failure to `ApiError`.
* **Fetch client** (`services/api/fetchClient.ts`) with the same contract (bearer, refresh-and-replay, `AbortSignal` + timeout, blob/multipart) used by `recordsApi.ts`.
* **Typed helpers** (`services/api/http.ts`) → **one endpoint module per service** (`services/endpoints/*Api.ts`) – each function takes an optional `AbortSignal` so TanStack Query can cancel it.
* **Token handling** (`tokenStore.ts`, `refresh.ts`, `authEvents.ts`): access token in memory, refresh token in `sessionStorage`, rotation-safe single-flight refresh, pub/sub channels (`sessionExpiredChannel`, `forbiddenChannel`) that the React tree subscribes to (`AuthProvider`).
* **Global error handling:** `ApiError` (`errors.ts`) + `QueryCache/MutationCache` handlers + `ErrorState`/`QueryBoundary` + field-error mapping into forms.
* **Utilities** (`utils/promise.ts`): `withTimeout` (Promise.race), `withRetry`, `allSettled`, `sequence`.

## 8. TanStack Query architecture (`src/app/queryClient.ts`, `src/services/queryKeys.ts`)
* **Key factories** per service (`queryKeys.patients.list(params)`, `.detail(id)`, `.byUser(id)`, `queryKeys.appointments.availability(doctorId, date)`, …) – hierarchical so `invalidateQueries({ queryKey: queryKeys.appointments.all })` cascades and `lists()` / `detail()` can be targeted.
* **Client defaults:** `staleTime 30 s`, `gcTime 5 min`, retry policy `shouldRetry` (never 4xx, max 2) with exponential `retryDelay`, refetch on focus/reconnect, `networkMode: 'online'`.
* **Query defaults per key** (`setQueryDefaults`): hospitals/specializations/lab tests 10 min + `offlineFirst`; availability and slots 5 s + `refetchOnWindowFocus: 'always'`; notifications 15 s.
* **Mutation defaults** (`setMutationDefaults`): optimistic appointment cancellation (`onMutate` → cancel queries, snapshot, patch every cached list/detail; `onError` → rollback; `onSettled` → invalidate) and invoice cancellation.
* **Caches:** `QueryCache.onError` / `MutationCache.onError|onSuccess` produce toasts from `meta` (`errorMessage`, `successMessage`, `silent`).
* **Patterns by module:** dependent queries (booking, appointment feed), parallel (`useQueries` – patient overview, billing counts), dynamic parallel (department directory, per-doctor appointments, report-per-row), infinite (lab history/reports, pharmacy orders), pagination with `placeholderData: keepPreviousData` (patients, lab requests, invoices, notifications), `initialData` from cached lists (details pages), `queryOptions()` (doctors), `select` (single medicine from the cached list), prefetching on hover (doctors, patients), optimistic updates (appointment cancel, lab status, payment initiation, restock), polling (`refetchInterval`: notifications, dashboard, lab/prescription status), removal/reset (`queryClient.clear()` on logout, Cache Monitor).
* **Global indicator:** `TopProgress` uses `useIsFetching` / `useIsMutating`.

## 9. Authentication architecture
```
LoginPage (RHF+Zod) ──authApi.login──► tokenStore.set(access in memory, refresh in sessionStorage)
        │                                   ▲                 ▲
        ▼                                   │                 │
AuthProvider (useReducer: loading|anonymous|authenticated)    refreshSession()  ◄── 401 in Axios/Fetch (single-flight)
  ├─ restore on load: refresh token present → refreshSession()      │
  ├─ renew timer: 60 s before exp                                    └─ fails → sessionExpiredChannel → logout('expired') + toast
  ├─ idle timer (VITE_IDLE_LOGOUT_MINUTES) → logout('idle')
  ├─ logout(): clear tokens, queryClient.clear(), POST /auth/logout (best effort)
  └─ useAuth / useAuthActions / useCan
Route protection: withAuth / withRoles / withPermission (components/hoc/withAccess.tsx) · UI: <Can>, can(role, permission)
```
Roles and permissions: six backend roles; 25 permissions in `constants/permissions.ts` (e.g. `appointments:book`, `lab:process`, `billing:manage`, `system:monitor`) used by the sidebar (`constants/navigation.tsx`), routes, buttons and dashboard widgets. Unsupported by the backend and therefore not built: MFA, OAuth 2.0, forgot/reset password.

## 10. Styling architecture
| Approach | Where |
|---|---|
| **MUI 6** | Patients, Doctors, Hospitals (+ shared MUI theme from `ThemeContext`) |
| **Tailwind CSS 3** (preflight off) | App shell, authentication, appointments, billing, notifications, dashboard, system pages |
| **Radix UI primitives + CSS Modules** | Medical records (`records.module.css`, Dialog/Tabs/Accordion/Tooltip) |
| **shadcn/ui-style components** (Radix + cva + tailwind-merge in `components/ui`) | Laboratory, Pharmacy, Prescriptions, shared dialogs/menus in the shell |
| **Global CSS** | `styles/global.css`: design tokens as CSS variables (light/dark), shared reset (headings, lists, tables), print rules, progress bar |
| **Flexbox / Grid** | Tailwind utilities, `.hms-grid-auto`, MUI `Stack`/`Grid2`, CSS Grid for calendar and layouts |
| **Theme management** | `ThemeContext` toggles `data-theme` + `.dark` on `<html>` (CSS variables + Tailwind `dark:`) and rebuilds the MUI theme; persisted in `localStorage`, defaults to the OS preference |
| **Responsive** | collapsible sidebar → off-canvas drawer < 1024 px, fluid grids, tables scroll horizontally, auth layout collapses to one column |
Library mixing rule: a component uses one UI library; shared Tailwind helpers (`QueryBoundary`, `PageHeader`, `Pagination`) are neutral wrappers around content.

## 11. Data flow
Example – **cancel an appointment** (optimistic, with rollback):
```
AppointmentListPage ─ click ─► ConfirmDialog.ask({askReason}) ─► useCancelAppointment().mutateAsync({id, reason})
   │  (mutation key ['appointments','cancel'] → defaults in queryClient.ts)
   ├─ onMutate : cancelQueries(appointments.*) → snapshot lists + detail → setQueriesData(status = CANCELLED)   ← UI updates instantly
   ├─ mutationFn: appointmentApi.cancel → Axios (bearer + correlation id) → gateway → Appointment service
   ├─ onError  : restore snapshots (rollback) → MutationCache.onError → toast
   ├─ onSuccess: toast "Appointment cancelled"
   └─ onSettled: invalidate appointments.*, doctors.*, billing.* (bill cancelled by Kafka), dashboard.*
                   → mounted queries refetch → server truth replaces the optimistic value
```
Example – **session**: `AuthProvider` mounts → refresh token in `sessionStorage`? → `POST /auth/refresh` → state `authenticated` → `NotificationsProvider` starts polling `/notifications/(my)` → pages issue queries with the bearer token; a 401 anywhere → `refreshSession()` once → original request replayed.
