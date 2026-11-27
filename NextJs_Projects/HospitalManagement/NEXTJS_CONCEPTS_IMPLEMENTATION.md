# Next.js Concepts Implementation

Every concept requested in the brief, with *what it does*, *why*, the *module*, the **exact file**, the *component/function* and *how it works here*. File paths are machine-checked against the repository (see the changelog). Where a concept has no meaningful healthcare use case in this project (or the platform does not provide it) the row says so instead of pretending.

## Next.js Fundamentals

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| What is Next.js / architecture | React framework with server rendering, routing, caching, server functions | One codebase for UI + BFF | Whole app | `NEXTJS_ARCHITECTURE.md` | — | Frontend + BFF over the existing Node.js gateway |
| Application structure | `src/app` App Router tree + feature folders | Scalable layout | Whole app | `src/app/layout.tsx` | `RootLayout` | Feature code in `src/features`, shared UI in `src/components` |
| Next.js CLI / init / dev / build | `create-next-app`, `next dev`, `next build`, `next start` | Standard workflow | Setup | `package.json` | scripts `dev` `build` `start` `lint` | Project created with `create-next-app@16.4.6`; build verified |
| next.config.ts | Typed framework configuration | Images, headers, experimental flags | Config | `next.config.ts` | `nextConfig` | remotePatterns, qualities, headers (Cache-Control/CDN), `staleTimes`, `serverActions.bodySizeLimit`, `optimizePackageImports` |
| Environment variables (public/private) | `NEXT_PUBLIC_*` reaches the browser, others stay on the server | No secrets in bundles | Config | `src/lib/config/env.ts`, `src/lib/config/public.ts`, `.env.example` | `serverEnv`, `publicEnv`, `APP_URL` | `server-only` import makes accidental client import a build error |
| TypeScript configuration | Strict TS with `@/*` alias and generated route types | Type safety | Whole app | `tsconfig.json`; `.next/types` | `PageProps<>`, `LayoutProps<>`, `RouteContext<>` | `next typegen` generates typed params/search params |
| Static assets / public folder | Files served from `/` | Banners and illustration | Public site | `public/images/*` | `hospitalBanner()` in `src/features/public/images.ts` | Referenced through `next/image` |
| Application entry points | Root layout/page | Single entry | Whole app | `src/app/layout.tsx`, `src/app/page.tsx` | `RootLayout`, `Home` | Providers (theme, query, toaster) wrap everything |
| Root layout | Wraps all routes, owns `<html>`/`<body>` | Fonts, theme init, providers | Whole app | `src/app/layout.tsx` | `RootLayout` | Applies font variables and the no-flash theme script |
| Nested layouts | Layout inside layout | Shells per area | Dashboard / Patients | `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/patients/[patientId]/layout.tsx` | `DashboardLayout`, `PatientLayout` | Dashboard shell → patient header+tabs → page |
| Templates | Layout that re-mounts per navigation | Entrance animation | Dashboard | `src/app/(dashboard)/template.tsx` | `DashboardTemplate` | Replays the fade-in on every navigation |
| Loading UI | Suspense fallback per segment | Instant feedback | Dashboard, records | `src/app/loading.tsx`, `src/app/(dashboard)/loading.tsx`, `…/medical-records/loading.tsx`, `…/@stats/loading.tsx` | `Loading`, `DashboardLoading` | Skeletons while data streams |
| Error UI | Error boundary per segment | Contain failures | Dashboard, records | `src/app/error.tsx`, `src/app/(dashboard)/error.tsx`, `…/medical-records/error.tsx` | `RootError`, `DashboardError`, `RecordsError` | `reset()` + `router.refresh()` retries the server render |
| Global error UI | Replaces the root layout when it crashes | Last-resort UI | Whole app | `src/app/global-error.tsx` | `GlobalError` | Renders its own `<html><body>` |
| Not found UI | 404 page and `notFound()` | Unknown URLs / records | Whole app | `src/app/not-found.tsx`, `src/app/(dashboard)/not-found.tsx` | `NotFound`, `DashboardNotFound` | `load()` in `src/lib/api/guards.ts` maps backend 404 → `notFound()` |
| Metadata / generateMetadata() | Titles, descriptions, Open Graph, robots | SEO + privacy | Public + dashboard | `src/app/layout.tsx`, `src/app/(public)/public/hospitals/[hospitalId]/page.tsx` | `metadata`, `generateMetadata` | Public pages expose only public facts; authenticated pages are `noindex` and generic |
| generateStaticParams() | Build-time param list | SSG | Public site | `…/public/hospitals/[hospitalId]/page.tsx`, `…/public/doctors/[doctorId]/page.tsx`, `…/public/info/[[...slug]]/page.tsx` | `generateStaticParams` | Hospitals/doctors from the backend; info/help from constants |
| Dynamic / static rendering | Per-request vs build-time HTML | Right strategy per page | Whole app | build output (`next build`) | — | See `ROUTING_AND_RENDERING.md` |
| Streaming + Suspense | Send shell first, fill later | Perceived speed | Dashboard, records | `src/app/(dashboard)/dashboard/layout.tsx`, `…/patients/[patientId]/medical-records/page.tsx` | parallel slots, `<Suspense>` | Each slot/panel streams independently |
| Error handling | `ApiError`, `load()`, `ActionState` | Uniform failures | Whole app | `src/lib/utilities/api-error.ts`, `src/lib/api/guards.ts`, `src/lib/actions/state.ts` | `ApiError`, `load`, `failure` | Backend `details` become field errors |
| Font optimisation | Self-hosted, subsetted fonts | No layout shift / no external request at runtime | Typography | `src/styles/fonts.ts` | `inter`, `monoLocal` | Google *Inter* (variable) + local DejaVu Sans Mono, `display: 'swap'` |
| Image optimisation | `next/image` resizing, AVIF/WebP | Performance | Public site, doctors | `src/app/page.tsx`, `src/features/public/DoctorDirectory.tsx`, `src/components/common/Avatar.tsx` | `<Image>` | Hero `priority`, lazy list images, remote avatars via `remotePatterns`, graceful `onError` fallback |

## Routing

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| App Router / file-system routing | Folders = URLs | Convention over config | Whole app | `src/app/**` | — | ~75 routes |
| page / layout / template / loading / error / not-found / global-error | Special files | See Fundamentals | Whole app | see Fundamentals rows | — | — |
| default.tsx | Fallback for an unmatched parallel slot | Hard-load safety | Dashboard, appointments | `src/app/(dashboard)/dashboard/@stats/default.tsx`, `…/@upcoming/default.tsx`, `…/@activity/default.tsx`, `src/app/(dashboard)/appointments/@modal/default.tsx` | `Default` | Returns `null` when the slot has no match |
| Route groups | Folders in parentheses | Separate layouts without changing URLs | Auth / Public / Dashboard / Admin | `src/app/(auth)/layout.tsx`, `src/app/(public)/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/(admin)/layout.tsx` | `AuthLayout`, `PublicLayout`, `DashboardLayout`, `AdminLayout` | `(admin)` adds a server-side role gate |
| Private folders | `_folder` opt-out of routing | Co-location | — | — | — | Not needed: shared code lives in `features/`, `components/` outside `app/` (documented decision) |
| Dynamic routes / segments / multiple params | `[param]` | Entity pages | Patients, doctors, hospitals, appointments, lab, billing, pharmacy | `src/app/(dashboard)/patients/[patientId]/page.tsx`, `…/appointments/[appointmentId]/page.tsx`, `…/billing/invoices/[invoiceId]/page.tsx` | `PatientOverview`, `AppointmentPage`, `InvoicePage` | `parseId()` validates; params is a Promise |
| Catch-all `[...topic]` | Matches 1+ segments | Help articles | Public site | `src/app/(public)/public/help/[...topic]/page.tsx` | `HelpPage` | `/public/help/appointments/booking` |
| Optional catch-all `[[...slug]]` | Matches 0+ segments | Info index + articles | Public site | `src/app/(public)/public/info/[[...slug]]/page.tsx` | `InfoPage` | `/public/info`, `/public/info/emergency/contacts` |
| Static / nested routes | Plain folders | Module pages | Whole app | `src/app/(dashboard)/billing/invoices/page.tsx` | `Invoices` | — |
| Parallel routes | `@slot` folders rendered side by side | Independent streaming sections / modal slot | Dashboard, appointments | `src/app/(dashboard)/dashboard/layout.tsx`, `src/app/(dashboard)/appointments/layout.tsx` | `DashboardSectionLayout`, `AppointmentsLayout` | Slots `stats`, `upcoming`, `activity`, `modal` |
| Intercepting routes + modal routing | `(.)` intercepts soft navigation | Appointment detail as modal over the list | Appointments | `src/app/(dashboard)/appointments/@modal/(.)[appointmentId]/page.tsx`, `src/features/appointments/RouteModal.tsx` | `AppointmentModal`, `RouteModal` | Close = `router.back()`; direct URL renders the full page |
| Route segment config | `export const revalidate/dynamic/dynamicParams` | ISR windows, static params policy | Public site, API | `…/public/hospitals/page.tsx` (`revalidate`), `…/public/info/[[...slug]]/page.tsx` (`dynamicParams`), `src/app/api/health/route.ts` (`dynamic`) | — | See rendering doc |
| notFound(), redirect(), permanentRedirect() | Control-flow helpers | Guards and aliases | Auth, patients, public | `src/lib/api/guards.ts`, `src/app/(dashboard)/patients/me/page.tsx`, `src/app/(public)/public/page.tsx` | `load`, `MyProfile`, `PublicIndex` | `permanentRedirect` = 308 `/public → /public/hospitals` |
| usePathname / useRouter / useSearchParams / useParams | Client navigation hooks | Breadcrumbs, row navigation, URL state | Shell, lists | `src/components/layouts/DashboardShell.tsx`, `src/hooks/useUrlState.ts`, `src/features/patients/PatientsTable.tsx`, `src/features/appointments/BookingWizard.tsx` | `Breadcrumbs`, `useUrlState` | `useParams` appears in no component: params are read on the server (`PageProps`) — documented choice |
| useSelectedLayoutSegment(s) | Active child segment of a layout | Active nav / tabs | Shell, patients, doctors | `src/components/layouts/DashboardShell.tsx`, `src/features/patients/PatientTabs.tsx`, `src/features/doctors/DoctorTabs.tsx` | `useActiveSegment`, `PatientTabs` | Highlights the current module/tab |
| router.push / replace / back / refresh / prefetch; Link | Programmatic navigation | UX | Wizard, modal, doctors board, filters | `src/features/patients/PatientRegisterWizard.tsx` (push), `src/hooks/useUrlState.ts` (replace), `src/features/appointments/RouteModal.tsx` (back), `src/app/(dashboard)/error.tsx` (refresh), `src/features/doctors/DoctorsBoard.tsx` (prefetch on hover) | — | `router.forward()` and `router.events` have no use case: the App Router exposes no navigation events (documented) |
| Query / search parameters | Server-readable URL state | Linkable filters + pagination | Patients, billing, notifications | `src/app/(dashboard)/patients/page.tsx`, `src/components/ui/pagination.tsx` | `PatientsPage`, `Pagination` | `searchParams` Promise → server query → URL pagination |

## Route Handlers / Backend development

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| GET / POST / PUT / PATCH / DELETE | HTTP verb exports | BFF endpoints | BFF | `src/app/api/appointments/[appointmentId]/route.ts`, `src/app/api/preferences/route.ts`, `src/app/api/backend/[...path]/route.ts` | `GET` `PATCH` `PUT` `DELETE` `POST` | Appointment adapter: GET/PATCH(reschedule)/PUT(complete)/DELETE(cancel) |
| Request / NextRequest / NextResponse | Typed request/response | Cookies, URL, JSON | BFF | `src/app/api/preferences/route.ts`, `src/app/api/auth/logout/route.ts` | `NextRequest`, `NextResponse.json` | — |
| Dynamic route handlers + params | `[id]` handlers | Resource endpoints | BFF | `src/app/api/lab/requests/[requestId]/attachment/route.ts`, `src/app/api/prescriptions/[prescriptionId]/download/route.ts` | `RouteContext<'…'>` | Typed params Promise |
| Request headers / cookies in, response cookies out | Read and set cookies/headers | Preferences, logout | BFF | `src/app/api/preferences/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/revalidate/route.ts` (`x-revalidate-secret`) | `req.cookies`, `res.cookies.set/delete` | — |
| Body parsing, status codes, content type, errors | `req.json()`, `formData()`, 400/401/403/404/413/415 | Validation | BFF | `src/app/api/preferences/route.ts`, `src/lib/api/route-helpers.ts` | `errorResponse`, `guard` | Zod validation → 400 body in backend error shape |
| File upload | multipart handling + validation | Lab attachments | Laboratory | `src/app/api/lab/requests/[requestId]/attachment/route.ts`, `src/features/laboratory/LabWorkflow.tsx` | `POST`, `AttachmentUpload` | Type (PDF/PNG/JPEG) and 5 MB checked, then forwarded |
| File download / streaming responses | Stream binary or generated files | Attachments, prescription, CSV, NDJSON | Lab, Rx, Patients, Dashboard | `…/attachment/route.ts` (GET), `src/app/api/prescriptions/[prescriptionId]/download/route.ts`, `src/app/api/patients/export/route.ts`, `src/app/api/dashboard/activity/route.ts` | `ReadableStream` | CSV pulls backend pages one by one; NDJSON flushes each metric when ready |
| BFF pass-through | One authenticated proxy for browser calls | HttpOnly JWT cannot be read by the browser | Whole app | `src/app/api/backend/[...path]/route.ts` | `forward` | Allow-list of prefixes, no business logic |
| Aggregation endpoint | Role-aware multi-service summary | Fewer round trips | Dashboard | `src/app/api/dashboard/summary/route.ts`, `src/lib/dashboard/metrics.ts` | `GET`, `getAppointmentStats`… | `Promise.all` over services; unreadable figures are `null` |
| On-demand revalidation webhook | `revalidateTag`/`revalidatePath` from outside | Let the backend refresh ISR pages | Public site | `src/app/api/revalidate/route.ts` | `POST` | Secret header; allow-listed tags |
| Server Functions / services / data access / business / validation / auth / error / config layers | Layered server code | Separation of concerns | Whole app | `src/services/backend/*.ts`, `src/lib/api/backend.ts`, `src/schemas/*.ts`, `src/lib/auth/session.ts`, `src/lib/utilities/api-error.ts`, `src/lib/config/env.ts` | `patientService`…, `backendFetch` | Repository-like service per microservice; business rules remain in Node.js |

## Server Components & Client Components

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| Async Server Components, server data fetching, server-side auth/authz | `async function Page()` awaiting data | Fast, secure rendering | Patients, doctors, billing … | `src/app/(dashboard)/patients/page.tsx`, `src/lib/auth/session.ts` | `PatientsPage`, `requirePermission` | Auth + permission checked before data is fetched |
| Server-only modules | `import 'server-only'` | Protect credentials | Whole server layer | `src/lib/api/backend.ts`, `src/lib/config/env.ts` | — | Build fails if imported from a Client Component |
| Composition / nesting / data passing | Server → client props, server children inside client | Minimal client JS | Records, doctors | `src/features/records/RecordsTabs.tsx`, `src/app/(dashboard)/doctors/page.tsx` | `RecordsTabs`, `DoctorsBoard` | Panels are server-rendered, passed as props |
| Client Components: state, handlers, browser APIs, hooks | `'use client'` | Interactivity | Boards, wizard, shell | `src/features/doctors/DoctorsBoard.tsx`, `src/features/pharmacy/MedicineBrowser.tsx`, `src/hooks/useOnlineStatus.ts` | — | Client-side filter/sort/search/tables/dialogs/tabs/date pickers (MUI X `DatePicker` in `src/components/forms/RhfFields.tsx`) |
| Props serialisation | Only serialisable values cross the boundary | Correctness | Whole app | `src/components/providers/AuthProvider.tsx` | `AuthProvider user={…}` | Token is never passed, only `{id, username, email, role}` |
| Server Actions from Client Components | Imported `'use server'` functions | Mutations | Whole app | `src/features/prescriptions/PrescriptionForm.tsx` → `src/actions/prescriptions.ts` | `createPrescriptionAction` | — |

## Rendering Strategies

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| SSG | Pre-rendered at build | Public static info | Public site | `src/app/page.tsx`, `src/app/(public)/public/info/[[...slug]]/page.tsx`, `src/app/(public)/public/help/[...topic]/page.tsx` | `Home`, `InfoPage` | Marked ○/● in the build output |
| ISR time-based | `revalidate` seconds | Fresh public catalogue | Public site | `src/app/(public)/public/hospitals/page.tsx` (3600 s), `src/app/(public)/public/doctors/page.tsx` (300 s), `src/lib/api/catalog.ts` | `revalidate`, `unstable_cache(…, {revalidate})` | Build output shows `1h`/`5m` |
| ISR on-demand | `revalidateTag`/`revalidatePath` | Instant updates after edits | Doctors, hospitals | `src/actions/doctors.ts` (`bust`), `src/actions/hospitals.ts` (`bust`), `src/app/api/revalidate/route.ts` | `revalidateTag(tag,'max')`, `revalidatePath` | Verified live: edited fee/department appears on public pages |
| SSR / dynamic rendering | Per-request HTML with user data | Personal data | Dashboard, patients, billing | `src/app/(dashboard)/dashboard/page.tsx`, `…/billing/invoices/[invoiceId]/page.tsx` | reads `cookies()` | Auth cookies make the route dynamic (ƒ in build) |
| CSR | Client-side fetching/rendering | Interactive search/filter | Doctor board, lab list, pharmacy | `src/features/laboratory/LabRequestsInfinite.tsx`, `src/features/public/DoctorDirectory.tsx` | `useInfiniteQuery`, `useDeferredValue` | — |
| Hydration / selective hydration / progressive rendering / deferred UI | Streamed HTML hydrates per Suspense boundary | Fast interaction | Dashboard | `src/app/(dashboard)/dashboard/layout.tsx`, `src/features/public/DoctorDirectory.tsx` | slots + `useDeferredValue` | `@defer` does not exist in Next.js; Suspense + `useDeferredValue` are used instead |
| Partial rendering / streaming | Shell instantly, slots later | Perceived speed | Dashboard | `…/dashboard/@stats/page.tsx` etc. | `Stats`, `Upcoming`, `Activity` | Independent loading skeletons |

## Data Fetching

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| Native fetch + options (headers, params, cache, revalidate, tags) | Server-side HTTP | Cache control | Server layer | `src/lib/api/backend.ts` | `backendResponse`, `backendFetch` | `cache`, `next.revalidate`, `next.tags`, bearer header, timeout |
| Parallel / sequential / dependent fetching | `Promise.all`, awaits in order | No waterfalls | Dashboard, hospital page, billing | `src/lib/dashboard/metrics.ts`, `src/app/(dashboard)/hospitals/[hospitalId]/page.tsx`, `src/app/(dashboard)/billing/invoices/[invoiceId]/page.tsx` | `getAppointmentStats` (dependent+parallel) | Invoice: bill first, then payments |
| Promise.all / allSettled / race | Combine promises | Resilience | Lab requests, metrics, catalogue | `src/actions/laboratory.ts` (`allSettled`), `src/lib/dashboard/metrics.ts` (`allSettled`, `all`) | `createLabRequestsAction` | `Promise.race` is not needed: `AbortSignal.timeout` already bounds every call |
| Axios + interceptors | Client HTTP client | Typed browser calls | Client | `src/services/api/client.ts`, `src/services/api/clientApis.ts` | `http`, `doctorsApi`… | Response interceptor → `ApiError`, 401 → login |
| Custom hooks, debouncing, throttling | Reusable behaviour | Search UX | Search boxes | `src/hooks/useDebounce.ts` (`useDebounce`, `useThrottle`) | — | Debounced patient/medicine search |
| Request cancellation / AbortController | Cancel stale requests | Avoid races | Client | `src/services/api/clientApis.ts` (signal), `src/store/slices/doctorsSlice.ts` (thunk abort) | `signal` | TanStack passes `AbortSignal` to Axios |
| Pagination / infinite scrolling | Paged endpoints | Large lists | Lab, pharmacy, patients | `src/features/laboratory/LabRequestsInfinite.tsx`, `src/features/pharmacy/OrdersInfinite.tsx`, `src/components/ui/pagination.tsx` | `useInfiniteQuery`, `IntersectionObserver`, `Pagination` | — |
| Preloading / prefetching | Warm data/routes | Snappier navigation | Doctors | `src/features/doctors/DoctorsBoard.tsx` | `router.prefetch`, `qc.prefetchQuery` | On card hover |
| Loading / error / empty states, retries | Every async view | UX | Whole app | `src/components/ui/empty-state.tsx`, `src/components/ui/skeleton.tsx`, `src/components/providers/QueryProvider.tsx` | `EmptyState`, `ErrorState`, `retry`, `retryDelay` | — |

## TanStack Query

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| QueryClient / Provider / defaults / caches | App-wide client | Server state | Whole dashboard | `src/components/providers/QueryProvider.tsx` | `makeClient`, `QueryCache`, `MutationCache` | staleTime 30 s, gcTime 5 min, retry/retryDelay, networkMode, toasts on error |
| useQuery, query keys, key factories, query functions | Cached reads | — | Doctors, slots, patients | `src/services/queryKeys.ts`, `src/features/appointments/hooks.ts` | `keys`, `useSlots`, `useDoctorList` | Hierarchical keys |
| Enabled / dependent queries, placeholder data | Conditional fetch | Slots need doctor+date | Booking | `src/features/appointments/hooks.ts` | `useSlots` (`enabled`, `keepPreviousData`) | — |
| Parallel queries / useQueries | One query per doctor | No all-appointments endpoint | Appointments | `src/features/appointments/hooks.ts` | `useDoctorAppointments` | `combine` merges results |
| Infinite queries | Paged cache | Large lists | Lab, pharmacy | `LabRequestsInfinite.tsx`, `OrdersInfinite.tsx` | `useInfiniteQuery` | `getNextPageParam` |
| Initial data / prefetching | Server-provided seed | No loading flash | Doctors | `src/features/doctors/DoctorsBoard.tsx` | `initialData`, `prefetchQuery` | — |
| Mutations, lifecycle, optimistic updates, cache updates, cancellation, invalidation | `useMutation` with `onMutate/onSuccess/onError/onSettled` | Instant UI | Appointments | `src/features/appointments/hooks.ts` | `useCancelAppointment` | Snapshot → optimistic `setQueriesData` → rollback → `invalidateQueries` |
| Background refetching, refetch interval, window focus | Keep data fresh | Live-ish data | Notifications, pharmacy, orders | `src/components/providers/NotificationsProvider.tsx`, `src/features/pharmacy/OrdersInfinite.tsx` | `refetchInterval` | 30 s / 20 s polling (backend has no push) |
| Data transformation | `select` | Shape data for the view | Doctors | `src/features/appointments/hooks.ts` (`useDoctorList`), `src/lib/utilities/slots.ts` (`groupSlots`) | `select` | — |

## Caching & Revalidation

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| Request memoisation | Dedupe within one render | Shared calls | Server layer | `src/lib/auth/session.ts`, `src/lib/auth/user.ts`, `src/lib/dashboard/metrics.ts` | `cache(...)` | `getSession`, `getCurrentUser`, metrics |
| Data cache, fetch `no-store` / `force-cache` / `revalidate` | Per-fetch policy | Right freshness per data class | Services | `src/services/backend/*.ts` | e.g. `doctorService.list` (60 s, tag), `patientService.list` (`no-store`) | `force-cache` is not used: the default (no option) + explicit `revalidate` express the same intent in this version |
| Cache tags + registry | Named invalidation groups | Targeted refresh | All mutations | `src/constants/cache.ts` | `CACHE_TAGS` | — |
| revalidatePath / revalidateTag / updateTag | Invalidate | Read-your-writes + SWR | Actions | `src/actions/doctors.ts`, `src/actions/appointments.ts`, `src/actions/billing.ts`, `src/actions/laboratory.ts` | `bust`, `refresh` | `updateTag` in actions, `revalidateTag(tag,'max')` for shared ISR entries |
| Full Route Cache / ISR | Static output with `revalidate` | Public speed | Public | `src/app/(public)/public/**` | — | — |
| Router cache | Client cache of visited routes | Fast back/forward | Whole app | `next.config.ts` | `experimental.staleTimes` | 30 s dynamic / 180 s static |
| Cache-Control / CDN | Headers | CDN caching of public pages only | Public / dashboard | `next.config.ts` | `headers()` | `/public/*` s-maxage 300 + SWR; dashboard `private, no-store` |
| Cache Components, `'use cache'`, cache profiles | Next 16 opt-in model | — | — | `next.config.ts` | not enabled | Mutually exclusive with route-segment config — documented decision |
| Sensitive data | Never in shared caches | Privacy | Patients, billing, records | `src/services/backend/patients.ts`, `billing.ts`, `records.ts` | `cache: 'no-store'` | — |

## React Hooks

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| useState / useReducer / useContext | Local and shared state | — | Forms, notifications, auth | `src/features/patients/DeactivatePatient.tsx`, `src/features/billing/BillForm.tsx`, `src/components/providers/AuthProvider.tsx` | — | — |
| useEffect | Side effects | Subscriptions, fetch triggers | Doctors board | `src/features/doctors/DoctorsBoard.tsx` | effects | — |
| useRef / useMemo / useCallback | Identity and memoisation | Avoid recompute | Lists | `src/features/laboratory/LabRequestsInfinite.tsx`, `src/features/appointments/AppointmentsBoard.tsx`, `src/components/providers/NotificationsProvider.tsx` | `useMemo`, `useCallback` | — |
| useLayoutEffect / useImperativeHandle | Layout-time effect / exposed ref API | Measurement, imperative widgets | Pharmacy | `src/components/common/VirtualList.tsx` | `useLayoutEffect`, `useImperativeHandle` | Measures the viewport before paint; exposes `scrollToIndex()` to the pharmacy list |
| useTransition / useDeferredValue | Non-urgent updates | Responsiveness | Filters, directory | `src/hooks/useUrlState.ts`, `src/features/public/DoctorDirectory.tsx` | `useTransition`, `useDeferredValue` | — |
| useId / useSyncExternalStore / useDebugValue | Stable ids, external stores, DevTools label | Hydration safety | Theme, online status | `src/components/providers/ThemeProvider.tsx`, `src/hooks/useOnlineStatus.ts`, `src/components/common/VirtualList.tsx` | `useSyncExternalStore`, `useDebugValue`, `useId` | Theme + connectivity stores; DevTools label; `useId` labels the listbox |
| useActionState / useFormStatus / useOptimistic / use() | React 19 form + async hooks | Server Action UX | Forms | `src/features/authentication/LoginForm.tsx`, `src/features/SubmitButton.tsx`, `src/features/appointments/AppointmentActions.tsx`, `src/features/laboratory/LabTestCatalogue.tsx` | `useActionState`, `useFormStatus`, `useOptimistic`, `use` | `use(testsPromise)` unwraps a server-started promise inside Suspense |

## State Management

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| useState | Patient forms | — | Patients | `src/features/patients/PatientEditForm.tsx` | — | — |
| useReducer | Billing form | Explicit transitions | Billing | `src/features/billing/BillForm.tsx` | `reducer` | Totals derived, not stored |
| Context API | Authentication, notifications, theme | Cross-tree state | Whole app | `src/components/providers/AuthProvider.tsx`, `NotificationsProvider.tsx`, `ThemeProvider.tsx` | `useAuth`, `useNotifications`, `useTheme` | — |
| Redux Toolkit + React Redux | Doctor management + appointment UI | Complex client state | Doctors, appointments | `src/store/redux/store.ts`, `src/store/slices/doctorsSlice.ts`, `src/store/slices/appointmentsSlice.ts`, `src/components/providers/ReduxProvider.tsx` | `configureStore`, `createSlice`, `createAsyncThunk`, `createEntityAdapter`, `createSelector`, `createAction`, `createReducer`, middleware, `useAppSelector/Dispatch/Store` | Normalised entities, memoised selectors, DevTools in dev |
| Zustand | Hospital browser, pharmacy filters, doctor shortlist | Lightweight shared state | Hospitals, pharmacy, doctors | `src/store/zustand/hospitalStore.ts`, `pharmacyStore.ts`, `shortlistStore.ts` | `create`, `persist`, `subscribeWithSelector`, derived `deriveMedicines` | `skipHydration` + manual `rehydrate()` in the shell |
| TanStack Query | Server state | — | Appointments, lab, pharmacy | see TanStack table | — | Server state is not duplicated in Redux/Zustand |
| URL state | Filters, pages, dates | Shareable | Lists | `src/hooks/useUrlState.ts` | `useUrlState` | — |

## Forms & Validation

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| React Hook Form + Zod | Patient registration, appointment booking, doctors, lab request, schedule | — | Patients, doctors, appointments, lab | `src/features/patients/PatientRegisterWizard.tsx`, `src/features/appointments/BookingWizard.tsx`, `src/features/doctors/DoctorForm.tsx`, `src/features/laboratory/LabRequestForm.tsx` | `useForm`, `register`, `handleSubmit`, `Controller`, `useController`, `useFieldArray`, `useWatch`, `setValue`, `reset`, `trigger`, `setError`, `formState` | Custom MUI fields in `src/components/forms/RhfFields.tsx` |
| Formik + Zod | Prescription generation | — | Prescriptions | `src/features/prescriptions/PrescriptionForm.tsx`, `src/lib/utilities/formikZod.ts` | `Formik`, `Form`, `Field`, `FieldArray`, `ErrorMessage`, `setFieldValue`, `validateForm`, `setTouched` | `zodValidate` converts issue paths to nested errors |
| Zod schemas | Validation everywhere | Single source of truth | All | `src/schemas/*.ts` | `z.object/string/number/boolean/array/enum`, `z.coerce`, `z.infer`, `superRefine`, cross-field rules | Same schemas run in the browser and in Server Actions |
| Server-side validation | Re-validation in actions | Never trust the client | Actions | `src/actions/*.ts`, `src/lib/actions/state.ts` | `safeParse`, `invalid`, `failure` | Field errors mapped back to forms |
| Multi-step, dynamic arrays, file upload, reset | Wizard / rows / upload / reset | — | Patients, Rx, lab | `PatientRegisterWizard.tsx`, `PrescriptionForm.tsx`, `LabWorkflow.tsx` | — | — |
| Controlled / uncontrolled | `value` vs `defaultValue` | — | Patients | `BookingWizard.tsx` (controlled), `PatientEditForm.tsx` (uncontrolled `defaultValue`) | — | — |

## Server Actions

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| 'use server' module-level actions | Exported async functions | Mutations | All domains | `src/actions/*.ts` | e.g. `registerPatientAction` | — |
| Inline Server Action | `'use server'` inside a component | Closure over server values | Notifications | `src/app/(dashboard)/notifications/page.tsx` | `markPageRead` | — |
| Form actions + FormData + progressive enhancement | `<form action={fn}>` | Works before hydration | Login, patient edit | `src/features/authentication/LoginForm.tsx`, `src/features/patients/PatientEditForm.tsx` | `useActionState` | — |
| Auth/authz in actions, security, args, return values | `authorize(permission)` first | Hiding a button is not security | All actions | `src/lib/actions/state.ts` | `authorize`, `ActionState` | Bound arguments: `saveHospitalAction.bind(null, id)` |
| Redirects, revalidation | `redirect`, `updateTag` | Navigation + fresh data | Auth, patients | `src/actions/auth.ts`, `src/actions/patients.ts` | `redirect`, `updateTag`, `revalidatePath` | — |
| The eight required actions | Patient registration/update, appointment booking/cancellation, prescription, lab request, billing, notification status | — | — | `src/actions/patients.ts`, `appointments.ts`, `prescriptions.ts`, `laboratory.ts`, `billing.ts`, `notifications.ts` | `registerPatientAction`, `updatePatientAction`, `bookAppointmentAction`, `cancelAppointmentAction`, `createPrescriptionAction`, `createLabRequestsAction`, `payBillAction`, `markNotificationsReadAction` | — |

## Proxy, Authentication, Authorization

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| Proxy (Middleware) | Request interception | Redirects, refresh, rewrite | Whole app | `src/proxy.ts` | `proxy`, `config.matcher` | Only Proxy is used (no Middleware file) |
| Redirects / protected routes / redirect after login | `/login?next=` | UX | Auth | `src/proxy.ts`, `src/actions/auth.ts` | `safeNext` | Open-redirect protected |
| URL rewriting | `/records → /medical-records` | Alias | Medical records | `src/proxy.ts` | `NextResponse.rewrite` | — |
| Headers, cookies, geolocation | `x-request-id`, `x-pathname`, `x-client-country` | Tracing | Whole app | `src/proxy.ts` | — | Geo header only exists behind a CDN that sets it |
| JWT, refresh, expiry, renewal | Bearer JWT, rotating refresh | — | Auth | `src/lib/auth/session.ts`, `src/lib/auth/jwt.ts`, `src/proxy.ts` | `setSessionCookies`, `refreshOnce` | Single-flight refresh |
| Session, logout, automatic logout | Cookie session | — | Auth | `src/actions/auth.ts`, `src/hooks/useIdleLogout.ts`, `src/app/api/auth/logout/route.ts` | `logoutAction`, `useIdleLogout` | 20 min idle |
| RBAC + permissions | Role → permission table | Defence in depth | Whole app | `src/constants/permissions.ts` | `can`, `requirePermission` | Mirrors backend roles |
| MFA / OAuth 2.0 / password reset | Not provided by the backend | Not faked | — | `src/app/(auth)/login/page.tsx` | notice | Documented as unsupported |

## Styling, Image, Font, Metadata, Performance, TypeScript

| Concept | What it does | Why it is used | Module | Exact file | Component / function | How it works here |
|---|---|---|---|---|---|---|
| MUI (App Router) | Emotion SSR cache + theme | Patients, doctors | Patients, doctors | `src/components/providers/MuiProvider.tsx` | `AppRouterCacheProvider` | Date pickers via `@mui/x-date-pickers` |
| Tailwind CSS | Utility CSS | Dashboard, appointments, billing | Several | `src/app/globals.css` | `@theme inline` | Design tokens |
| Radix UI | Accessible primitives | Dialogs, tabs, menus | Records, shell | `src/components/ui/dialog.tsx`, `tabs.tsx`, `dropdown.tsx` | `@radix-ui/*` | — |
| shadcn/ui-style components | `cva` + Radix Slot | Lab, pharmacy, notifications | Several | `src/components/ui/button.tsx`, `table.tsx`, `badge.tsx`, `input.tsx` | `Button`, `Table`… | — |
| Dark/light theme, global CSS, responsive, flex/grid | Tokens + `.dark` | — | Whole app | `src/components/providers/ThemeProvider.tsx`, `src/app/globals.css` | `ThemeProvider`, `themeInitScript` | `useSyncExternalStore` |
| next/image features | width/height, fill, sizes, priority, lazy, quality, remote patterns | — | Public, doctors | `src/app/(public)/public/hospitals/[hospitalId]/page.tsx`, `src/app/page.tsx`, `next.config.ts` | `<Image>` | Blur placeholders are not used: banners are small generated JPEGs; documented |
| next/font | Google variable + local | — | Typography | `src/styles/fonts.ts` | `Inter`, `localFont` | — |
| Metadata (titles, OG, Twitter, canonical, robots, icons, templates) | SEO | — | Root, public | `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/icon.svg` | `metadata`, `robots`, `sitemap` | — |
| Dynamic imports / code splitting | `next/dynamic` | Smaller initial JS | Pharmacy | `src/features/pharmacy/MedicineBrowser.tsx` | `dynamic(() => import('./Dialogs'))` | Dialog JS loads on first open |
| Package optimisation / tree shaking | `optimizePackageImports` | Bundle size | Config | `next.config.ts` | — | MUI, MUI X, lucide |
| React.memo / virtualisation | Avoid re-renders / render only visible rows | Large lists | Lab | `src/components/common/VirtualList.tsx` | `memo` rows, windowed rendering | Only visible rows mount; toggle "Virtualised list" in `/pharmacy` |
| TypeScript | Strict typing, typed routes, typed API models | — | Whole app | `src/types/*.ts`, `tsconfig.json` | `ApiError`, `ActionState<T>`, `PageProps` | `npx tsc --noEmit` clean |
