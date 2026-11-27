# Implementation Changelog

Single release **1.0.0 – 2026-11-12**, built from `claude-prompts/promptdo-12112026a.md`. The Node.js backend (`NodeJS_Projects/HospitalManagement`) and its databases were **not modified**; the application talks to the API gateway (`:30080`) only. Entries follow the order the work was done.

## Summary of what exists
* ~190 source files, ~9,200 lines of TypeScript (`src/app`), 13 feature areas, 10 API services, 24 permissions, 5 NgRx slices + 1 Component Store + 1 Signal Store.
* Angular **19.2.25**, NgRx 19.2, RxJS 7.8, Angular Material 19, Tailwind 3, PrimeNG 19, Bootstrap 5.3 (scoped), zoneless change detection.
* Production build: initial bundle **1.05 MB raw / 217 kB transferred** (`main` 19.7 kB + shared chunks + styles 26 kB), 159 lazy JS chunks.

## Phase 1 – Backend discovery
* Read the backend README, the ten API documents, `api-gateway/config/routes.json`, and the OpenAPI documents (`http://localhost:30080/docs-json/<service>`); verified the gateway answers on `:30080` and that all calls reach the right service.
* Findings that shaped the design (details in `API_INTEGRATION_DOCUMENTATION.md`): refresh token only in the JSON body; no list-all-appointments endpoint; no doctor-by-login lookup; no notification read flag/push; un-paged arrays for hospitals/medicines/bills-by-patient/lab-by-patient; `/lab`, `/bills`, `/pharmacy` restricted by role at the gateway.
* Decision: **Angular 19.2** because the machine's Node is 20.11.1 (newer Angular lines require a newer Node).

## Phase 2 – Project setup
* Hand-created the Angular CLI project (`angular.json`, `tsconfig*.json`, `package.json`, `proxy.conf.json` → `http://localhost:30080`, `tailwind.config.js`, `.env.example`, `.gitignore`), dev port **4300**, environments in `src/environments`.
* Global styles in `src/styles/styles.scss`: Material M3 theme, Tailwind layers, **Bootstrap emitted only inside `.bs-scope`** (so its utilities cannot collide with Tailwind's), PrimeNG icons, tokens.

## Phase 3 – Core architecture (`src/app/core`)
* Configuration and DI tokens (`configuration/app-config.ts`): `useClass/useValue/useFactory/useExisting`, `forwardRef`, multi providers, `providedIn: 'platform'`, `LogLevel` enum.
* Typed models for every API contract (`models/*.ts`), `ApiError`, `LoadState<T>`.
* Auth (`auth/*`): in-memory access token, `sessionStorage` refresh token, single-flight refresh, session restore in `provideAppInitializer`, signals for user/status/role, 24-permission matrix.
* HTTP: `BaseApiService`/`CrudApiService` + 10 API services; interceptor chain `[loading, logging, error, retry, auth]` + class-based `CorrelationIdInterceptor`; `HttpContextToken`s.
* Guards/resolvers: `authGuard`, `publicOnlyGuard`, `authChildGuard`, `roleGuard`, `permissionGuard`, `canMatchPermission`, `unsavedChangesGuard`, class guards `PatientOwnershipGuard` and `AdminRoleGuard`, functional resolvers.
* Services: logging, loading, notification (snackbar), notification centre (polling), theme, session manager (idle logout, renewal), event bus (4 Subject types), file, current identity, navigation events, custom preloading + route-reuse strategies, global error handler.

## Phase 4 – Shared UI kit (`src/app/shared`)
Components (page header, stat card, state views with a generic `DataStateComponent<T>`, tabs with content queries, card, confirm dialog, patient picker with `model()`, file dropzone, slot picker, search box, pager, notice, **`QuantityStepper` ControlValueAccessor**), directives (`appHighlight`, `appFocus`, `appClickOutside`, `appTooltip`, `*appHasPermission`, `*appRole`, composed `appInteractive`), pipes (6 pure, 2 impure), validators (sync, cross-field, conditional, **async**, template-driven directives), `SignalForm`, `toLoadState`, `countdown$`.

## Phase 5 – State management (`src/app/state`)
Actions (`createAction`, `createActionGroup`), reducers + `createFeature`, entity adapters, memoised and parameterised selectors, router selectors, class and functional effects, optimistic cancel with rollback, normalised hospitals/departments, persisted doctor-list preferences, `LabRequestStore` (Component Store), `PharmacyStore` (Signal Store), Store DevTools. Root slices: appointments, hospitals; lazy slices via route providers: patients, doctors, billing.

## Phase 6 – Feature modules and scenarios
| Module | Routes | UI | Highlights |
|---|---|---|---|
| Authentication | `/auth/login`, `/auth/register`, `/access-denied`, `/unauthorized`, `**` | Tailwind | typed login form, redirect after login, public-only guard |
| Dashboard | `/dashboard` | Tailwind | `forkJoin` widgets with `timeout`/`catchError`, `@defer`, stale-while-revalidate (`concat`) |
| Patients | list, register, details (+tabs), edit, contact (template-driven), `profile`, quick view (auxiliary route) | Material | scenario 1, typed nested form, Store with lazy slice |
| Doctors | list (compare dialog), details, schedule `FormArray`, availability `resource()`, create/edit | Material | functional effects, signal/NgRx facade |
| Appointments | list, book, details, reschedule, calendar, availability | Tailwind | scenarios 2 and 3, `linkedSignal`, optimistic cancel, lifecycle-hook demo, countdown |
| Hospitals | list, details (overview/departments/facilities), form | Bootstrap | element-injector DI demo (`viewProviders`, `host`, `skipSelf`, `optional`), legacy directives panel |
| Medical records | home, patient record, entry, documents | PrimeNG | `rxResource`, CDK virtual scroll, `@defer`, upload progress, ownership guard |
| Prescriptions | list, new, details | Material | scenario 5, `FormArray`, async validator, dynamic-import export |
| Laboratory | catalogue, requests, new, details, history | PrimeNG | scenario 4, Component Store, lazy `p-table`, report + attachment |
| Billing | dashboard, invoices, details, payments, generate | Bootstrap | scenario 6, NgRx slice + class effects, sequential settlement |
| Pharmacy | medicines, details, orders, medicine form | PrimeNG | Signal Store, `SignalForm`, polling, dispense/reject dialog |
| Notifications | list, unread, details, send | Tailwind | polling feed, local read state, template-driven send form |
| Administration | `/admin/users` | Tailwind | **isolated NgModule**, non-standalone components, `canMatch`, class guard |

## Phase 7 – UI/UX
Responsive Material sidenav shell with breadcrumbs, header with theme toggle / notification bell (unread badge) / user menu, light and dark themes for all four libraries, skeletons, empty and error states with retry, confirmation dialogs, snackbars, global progress bar, loading/disabled states on every submit.

## Phase 8 – Documentation
`README.md`, `ANGULAR_ARCHITECTURE.md`, `ANGULAR_CONCEPTS_IMPLEMENTATION.md`, `SIGNALS_IMPLEMENTATION.md`, `NGRX_IMPLEMENTATION.md`, `RXJS_IMPLEMENTATION.md`, `API_INTEGRATION_DOCUMENTATION.md`, `BUSINESS_FLOWS.md`, `IMPLEMENTATION_CHANGELOG.md` (this file). File paths in the documents were checked against the file system with a script.

## Verification results
No test suites were written (explicitly out of scope). Verification was done by running the real application:
* `ng build` (production) ✔ – no errors; remaining warnings are informational (optional-chain/nullish hints in a few templates, one Tailwind-selector note).
* `ng serve` on `:4300` with the proxy to the live gateway ✔.
* **Route sweep** with headless Google Chrome (throw-away driver script kept outside the project): 27 routes as ADMIN with no console errors and no unexpected 4xx/5xx; 5–7 routes each for LAB_STAFF, PHARMACIST, BILLING_STAFF, DOCTOR and a PATIENT – other roles' routes answer the 403 page, `/admin/users` is a 404 for non-admins (`canMatch`), anonymous users are redirected to login.
* **Business scenarios** against the live backend (all passed): registration (validation, account + login + profile), booking (disabled taken slot, reschedule, optimistic cancel), availability (day off blocks booking, removed again), lab request → status → report, prescription (async validator, FormArray add/remove, generation, details), billing (live total, payment initiated and confirmed → PAID), pharmacy (orders listed, dialog, **dispense**, restock), notifications, patient-ownership guard (own record allowed, other patient's record → 403 page), unsaved-changes guard (`CanDeactivate`), compare dialog (`zip`), auxiliary route `quick`, template-driven contact tab.
* Token refresh: a forced `401` on `GET /patients` triggered one refresh and a transparent replay without signing the user out; logout and guard redirects verified.
* Dark theme (applied to all four libraries) and the 390 px mobile layout (no horizontal overflow) checked, screenshots reviewed.

### Defects found by the live verification (all fixed)
| # | Defect | Fix |
|---|---|---|
| 1 | Breadcrumbs threw `Cannot read properties of undefined (reading 'url')` while a navigation was in flight | `src/app/layouts/main-layout/breadcrumbs.component.ts` skips routes without snapshot; duplicate crumbs ("Billing › Billing") de-duplicated |
| 2 | Invoice list froze the tab: an `effect` tracked the filter *object* that the action it dispatched replaces → infinite loop | effect now depends on the primitive `status|page` key and dispatches in `untracked` (`src/app/features/billing/billing-invoices.component.ts`) |
| 3 | Dashboard logged `NG0203 toObservable() outside an injection context` (feed `load()` called from an effect) | `runInInjectionContext(EnvironmentInjector, …)` + `take(1)` in `src/app/features/appointments/appointment-feed.facade.ts` |
| 4 | Pharmacy orders showed nothing for 15 s: `combineLatest` waited for `timer(15000, …)`'s first emission | `timer(0, 15_000)` (`src/app/features/pharmacy/pharmacy-orders.component.ts`) |
| 5 | Lab request details probed `GET …/report` and logged a 404 for every open request | report fetched only when the request is COMPLETED (`src/app/features/laboratory/lab-request-details.component.ts`) |
| 6 | Hospital card "More" threw `NG0201 No provider for CardExpansionState` – `{ host: true }` lookups see the host's `viewProviders`, not `providers` | state moved to `viewProviders` (`src/app/features/hospitals/hospital-card.component.ts`) |
| 7 | Empty bordered side panel permanently visible (auxiliary `quick` outlet) | `<aside>` rendered only while the auxiliary route is active (`src/app/layouts/main-layout/main-layout.component.ts`) |
| 8 | Patient search box showed the literal text "undefined": `withComponentInputBinding` overwrites an `input('')` default with `undefined` when the query param is absent | `transform` normalising `undefined` on the query-param inputs (`src/app/features/patients/patient-list.component.ts`) – found while reviewing the dark-theme screenshot |
| 9 | Concept audit gaps (operators `interval/concat/zip/defer/pairwise/takeWhile/first`, `ControlValueAccessor`, `ViewEncapsulation`, `viewProviders`, `runInInjectionContext`, enum) | implemented in real places, see the concept documents |

## Features implemented vs. specification
All ten service modules, all six business scenarios, routing/guards/preloading/auxiliary routes, NgRx (Store, Effects, Entity, Router Store, DevTools, Component Store, Signal Store), Signals (`signal/computed/effect/untracked/linkedSignal/resource/rxResource/model/input/output/queries/toSignal/toObservable`), typed Reactive Forms + template-driven forms + signal forms, DI (all provider kinds and resolution modifiers), HTTP interceptors (functional and class-based), directives and pipes (pure and impure), four UI libraries and light/dark themes, an isolated NgModule feature and all nine documents.

## Limitations and pending functionality (honest list)
**Backend limitations** (documented in `API_INTEGRATION_DOCUMENTATION.md#unavailable-or-missing-apis`; none were faked): MFA, OAuth 2.0/social login, password reset, HttpOnly refresh cookie, notification read flag and push/real-time, hospital branches and facility inventory, medicine categories, patient-document upload (only lab-report attachments exist), prescription update/PDF, appointment "confirm" action, a list-all-appointments endpoint, a dashboard statistics endpoint, server-side sorting, paging for several list endpoints.

**Frontend notes**
* Angular 19.2 has **no official signal forms**; `src/app/shared/utilities/signal-form.ts` is a purpose-built implementation. `resource()`, `rxResource()`, `linkedSignal()` and zoneless change detection are developer-preview/experimental APIs in this version.
* Notification read state is local to the browser (labelled in the UI); notifications are polled (30 s) because there is no push channel.
* The admin "all appointments" view and the dashboard appointment figures are computed with one request per doctor (fine for a hospital-sized roster, not for thousands).
* Executed against the shared data: everything listed under *Business scenarios*. **Not** executed to keep the shared data usable: deactivating patients/doctors/hospitals, creating/disabling user accounts, rejecting pharmacy orders, completing appointments (backend allows it only once the slot has started), lab attachment upload/download (needs a file), sending an admin notification.
* Idle-timeout logout (30 min) and proactive token renewal are implemented but were not waited out in the browser; the 401 → refresh → replay path they share was verified.
* Only compile-time checks and the headless-Chrome run above were performed; no automated tests, linting, monitoring or infrastructure files exist by design.
* Test data created in the shared development databases: patient `Nila Patel` (+ its login `ngpat…`), appointment #27 (rescheduled then cancelled), prescriptions #15–#17, three lab requests, several invoices/payments (three $150 test invoices), three restocks of +5 on *Amoxicillin 500mg* and one dispensed pharmacy order (net stock +10), and the notifications generated by the events. A temporary doctor day off was added and removed again.

## Configuration changes
New project only. Dev server port **4300**; environment keys `apiBaseUrl`, `zoneless`, `idleLogoutMinutes`, `apiTimeoutMs`; proxy target in `proxy.conf.json`. No change to the backend project, its databases or its configuration.
