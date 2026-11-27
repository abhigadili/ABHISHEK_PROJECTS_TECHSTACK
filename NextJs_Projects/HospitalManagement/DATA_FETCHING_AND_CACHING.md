# Data Fetching and Caching

## Server-side fetching
* **Native `fetch`** is wrapped once in `src/lib/api/backend.ts` — `backendResponse()` (raw `Response`, used for downloads/streams) and `backendFetch<T>()` (typed JSON). It injects the bearer token (`auth: 'session' | 'none' | {token}`), JSON/FormData bodies, query params, `AbortSignal.timeout(15 s)`, cache options and maps non-2xx bodies to an `ApiError` (field errors parsed from `details: ["field: message"]`).
* One **server-only service module per microservice** in `src/services/backend/*.ts` (auth, patients, doctors, appointments, hospitals, records, prescriptions, laboratory, billing, pharmacy, notifications).
* Pages are async Server Components: `const p = await load(patientService.get(id))` (`load()` maps 404 → `notFound()`, 403 → `/access-denied`).
* **401 on the server** → `redirect('/login?reason=expired')` (pages) or an `ApiError` (actions/handlers); the proxy normally refreshes the token before this happens.

### Patterns
| Pattern | Example (file) |
|---|---|
| Parallel (`Promise.all`) | `app/(dashboard)/hospitals/[hospitalId]/page.tsx` (hospital + departments + doctors), `lib/dashboard/metrics.ts` |
| Sequential | `…/billing/invoices/[invoiceId]/page.tsx` (bill, then its payments), `actions/billing.ts` (pay → status) |
| Dependent | `lib/dashboard/metrics.ts` `getAppointmentStats` (doctors first, then one appointment query per doctor); `(public)/public/doctors/[doctorId]/page.tsx` (doctor → hospital) |
| `Promise.allSettled` | `actions/laboratory.ts` (one request per test, partial success reported), `lib/dashboard/metrics.ts` |
| `Promise.race` | not needed — every request is bounded by `AbortSignal.timeout` (the race is built in) |
| Streaming + Suspense | dashboard slots, medical-record panels, `laboratory/tests` (`use()`) |
| Server-to-server | every `services/backend/*` call; the BFF handlers |
| Transformation | `lib/utilities/slots.ts` (`groupSlots`), `actions/patients.ts` (`toInput`) |
| Error handling | `ApiError`, `load()`, `loadOptional()`, `app/**/error.tsx` |

## Client-side fetching
* **Axios** (`src/services/api/client.ts`) with base URL `/api/backend` (the BFF), response interceptor → `ApiError`, cancellation ignored, 401 → login. Typed modules in `src/services/api/clientApis.ts`.
* **Custom hooks**: `hooks/useDebounce.ts` (debounce + throttle), `hooks/useUrlState.ts`, `features/appointments/hooks.ts`.
* **Cancellation**: TanStack passes an `AbortSignal` to every Axios call; the Redux thunk in `store/slices/doctorsSlice.ts` aborts its request when the thunk is aborted.
* **Browser Fetch API** is used for the file upload (`features/laboratory/LabWorkflow.tsx`) and the idle-logout beacon (`components/layouts/DashboardShell.tsx`).

## TanStack Query
Provider/defaults: `components/providers/QueryProvider.tsx` — `staleTime 30 s`, `gcTime 5 min`, `retry` (never on 4xx, max 2), `retryDelay` exponential, `networkMode: 'online'`, `QueryCache`/`MutationCache` `onError` → toasts. Key factories: `services/queryKeys.ts`.

| Concept | Where |
|---|---|
| `useQuery`, enabled/dependent, `placeholderData: keepPreviousData` | `features/appointments/hooks.ts` `useSlots` |
| `useQueries` (+ `combine`) | `useDoctorAppointments` |
| `useInfiniteQuery` | `features/laboratory/LabRequestsInfinite.tsx`, `features/pharmacy/OrdersInfinite.tsx` |
| `initialData` / `prefetchQuery` | `features/doctors/DoctorsBoard.tsx` |
| `useMutation` + `onMutate/onSuccess/onError/onSettled`, optimistic update, `cancelQueries`, `setQueriesData`, rollback, `invalidateQueries` | `useCancelAppointment` |
| Background refetch / polling | `NotificationsProvider` (30 s), `OrdersInfinite` (20 s), `MedicineBrowser` (60 s), window-focus refetch |
| `select` transformation | `useDoctorList`, `groupSlots` |
| Query/mutation cache, defaults | `QueryProvider` |
| Network mode | `QueryProvider` defaults |

Server state is **not** duplicated in Redux/Zustand: Redux holds the doctor *list* for the management board (loaded by a thunk), but the specialization lookup, slots, appointments, lab and pharmacy data live only in TanStack Query.

## Caching
### What is cached, what is dynamic, why, and how it is invalidated

| Data | Policy | Where | Why | Invalidation |
|---|---|---|---|---|
| Public hospitals, departments, doctors, specializations | `unstable_cache`, `revalidate` 3600 / 300 s, tags `hospitals`, `departments`, `doctors` | `lib/api/catalog.ts` | Public, rarely changes; key must not include the rotating service token | `revalidateTag(tag,'max')` + `revalidatePath` in `actions/doctors.ts`, `actions/hospitals.ts`, webhook `api/revalidate` |
| Public pages (HTML) | Full Route Cache, ISR | `app/(public)/public/**` | CDN-friendly | same + time window |
| Doctors list/detail, specializations, schedule, days off (authenticated) | `fetch` data cache 60/600 s with tags `doctors`, `doctor-schedule-{id}` | `services/backend/doctors.ts` | Reference data; the Authorization header is part of the cache key → entries are **per session**, never shared between users | `updateTag` in `actions/doctors.ts` |
| Hospitals, departments (authenticated) | 60 s, tags `hospitals`, `departments` | `services/backend/hospitals.ts` | Reference data | `updateTag` in `actions/hospitals.ts` |
| Lab test catalogue | 300 s | `services/backend/laboratory.ts` | Price list | time-based |
| Medicines (authenticated) | 30 s, tag `pharmacy` | `services/backend/pharmacy.ts` | Stock changes often | `updateTag` after dispense/restock |
| **Patients, medical records, appointments, availability, lab requests/reports, prescriptions, bills, payments, notifications** | `cache: 'no-store'` | all other `services/backend/*` | Personal medical/financial data must never be cached or shared; availability must be exact | not applicable (dynamic) |
| Router cache | 30 s dynamic / 180 s static | `next.config.ts` | Snappier navigation | `revalidatePath` clears it for that path |

Scenario mapping: (1) hospital info cached → `unstable_cache`; (2) doctor directory cached; (3) doctor update revalidates (`bust()` in `actions/doctors.ts`); (4) booking revalidates availability (`updateTag(CACHE_TAGS.availability(id))` + `revalidatePath('/appointments')`); (5) patient update → `updateTag(patient-{id})` + `revalidatePath`; (6) report completion → `updateTag(lab-reports)`; (7) payment → `updateTag(billing)` + invoice paths; (8) sensitive data → `no-store`.

### API reference
* **Request memoisation**: identical GET fetches in one render are deduplicated; `React.cache` wraps `getSession`, `getCurrentUser`, dashboard metric functions.
* **Fetch cache options**: `cache: 'no-store'`, `next: { revalidate, tags }` (see `BackendOptions`). `force-cache` is not used (the explicit `revalidate`/tags express the same intent).
* **`revalidatePath` / `revalidateTag(tag, 'max')` / `updateTag`**: `updateTag` (Server Actions) gives read-your-writes; `revalidateTag(...,'max')` marks shared ISR entries stale-while-revalidate (the one-argument form is deprecated). Tags registry: `constants/cache.ts`.
* **Cache Components / `'use cache'` / cache profiles**: available in Next 16 but intentionally **not enabled** (they forbid route-segment config and fetch `revalidate`, which this project demonstrates).
* **Cache-Control / CDN**: `next.config.ts` `headers()` — `/public/*` `public, s-maxage=300, stale-while-revalidate=3600`; authenticated routes `private, no-store`; BFF responses `private, no-store`.
