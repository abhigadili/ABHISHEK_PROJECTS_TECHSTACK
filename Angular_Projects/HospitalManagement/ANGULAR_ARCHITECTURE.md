# Angular Architecture

## 1. Technology stack
| Concern | Choice (version) |
|---|---|
| Framework | Angular **19.2.25** – standalone components everywhere (one isolated NgModule), new control flow (`@if/@for/@switch/@defer/@let`), Signals, zoneless |
| Why 19.2 | newest line supported by the machine's Node 20.11.1 |
| State | NgRx 19.2: Store, Effects, Entity, Router Store, Store Devtools, Component Store, Signal Store |
| Async | RxJS 7.8 + `@angular/core/rxjs-interop` |
| UI | Angular Material 19 (M3 theme), Tailwind 3, PrimeNG 19 (Aura preset), Bootstrap 5.3 (scoped) |
| Build | Angular CLI 19.2 (esbuild application builder) |

## 2. Layers and dependency direction
```
features/*  ──▶  shared/*  ──▶  core/*        state/* (NgRx)  ◀── features/*
   (pages)      (UI kit)       (singletons)      (slices, stores)
```
* **`src/app/core`** – application singletons, no UI: configuration tokens, models, auth, HTTP interceptors, API services, guards/resolvers, infrastructure services. Nothing in `core` imports from `features`.
* **`src/app/shared`** – reusable, stateless UI building blocks: components, directives, pipes, validators, utilities.
* **`src/app/state`** – NgRx actions/reducers/selectors/effects/entities plus the Component Store and Signal Store.
* **`src/app/features/<module>`** – one folder per business module with its routes, page components and feature services. Each module is lazy loaded.
* **`src/app/layouts`** – application shells (main with Material sidenav, auth, admin).

## 3. Folder structure (`src/app`)
```
app.component.ts · app.config.ts · app.routes.ts
core/
  api/            base-api.service.ts + one API service per backend service (10)
  auth/           auth.service.ts · token-store.service.ts · permissions.ts
  configuration/  app-config.ts (DI tokens, providers)
  guards/         auth.guards.ts · unsaved-changes.guard.ts · patient-ownership.guard.ts · resolvers.ts
  interceptors/   http-context.ts · loading · logging · error · retry · auth (functional) · correlation-id (class)
  models/         API contracts (typed) · api-error.ts (ApiError, LoadState)
  services/       logging, loading, notification (snackbar), notification-center, theme, session-manager, event-bus,
                  file, current-identity, navigation-events, routing-strategies, app-error-handler
shared/
  components/     page-header, stat-card, state-views (empty/error/skeleton/data-state), tabs, card, confirm-dialog,
                  patient-picker, file-dropzone, slot-picker, search-box, pager, notice, quantity-stepper
  directives/directives.ts   pipes/pipes.ts   validators/validators.ts + template-validators.ts
  utilities/      signal-form.ts · load-state.ts · helpers.ts · countdown.ts
state/
  actions · reducers · selectors · effects · entities   (patients, doctors, appointments, billing, hospitals)
  feature-stores/ lab-request.store.ts (Component Store) · pharmacy.store.ts (Signal Store)
  index.ts        provideAppState()
features/         authentication · dashboard · patients · doctors · appointments · hospitals · medical-records ·
                  prescriptions · laboratory · billing · pharmacy · notifications · admin (NgModule)
layouts/          main-layout · auth-layout · admin-layout · nav-items.ts
```

## 4. Application bootstrap
`src/main.ts` calls `bootstrapApplication(AppComponent, appConfig)` (no root NgModule). `src/app/app.config.ts` assembles the environment providers in this order:

1. **Change detection** – `provideExperimentalZonelessChangeDetection()` when `environment.zoneless` (default), otherwise `provideZoneChangeDetection`. Every component is `OnPush` and driven by signals/`async`-free templates, so the zoneless mode is safe; the build's `polyfills` list is empty (`angular.json`), i.e. **zone.js is not shipped**. To use zone.js instead, set `zoneless: false` and add `"zone.js"` to the build polyfills.
2. **Router** – `provideRouter(routes, withComponentInputBinding(), withPreloading(SelectivePreloadingStrategy), withInMemoryScrolling, withRouterConfig, withNavigationErrorHandler)` + custom `RouteReuseStrategy`.
3. **HttpClient** – functional interceptors `[loading, logging, error, retry, auth]` and `withInterceptorsFromDi()` for the class-based `CorrelationIdInterceptor` (see §6).
4. **NgRx** – `provideAppState()` (`state/index.ts`): `provideStore`, `provideEffects`, root feature slices (appointments, hospitals), `provideRouterStore`, `provideStoreDevtools`.
5. **UI** – `provideAnimationsAsync`, `provideNativeDateAdapter`, `providePrimeNG` (Aura, `.dark` selector).
6. **DI** – logger (`useClass`), `ErrorHandler` (`useClass`), notification channel (`useExisting` + `forwardRef`), navigation multi-providers.
7. **`provideAppInitializer`** – eager singletons and **session restore** (refresh-token exchange) *before* the first navigation, so guards see the right state on a hard reload.

## 5. Routing
`app.routes.ts` is the single route table:
* `/auth/*` → `auth-layout` (`login` guarded by `publicOnlyGuard`).
* Everything else is a child of `main-layout` guarded by `authGuard` + `authChildGuard`; each feature is `loadChildren` (lazy) and declares `data: { breadcrumb, preload }`.
* `quick-view/:id` with `outlet: 'quick'` is the **auxiliary route** rendered in the named `quick` outlet (patient quick view, URL form `/patients(quick:quick-view/7)`).
* `admin` is loaded with `canMatch: [canMatchPermission('users:manage')]` – for non-admins the route does not match at all (404), the NgModule chunk is never downloaded.
* `access-denied` (403 page), `unauthorized`, `not-found`, `**`.
* Feature route files: `features/<module>/<module>.routes.ts`. Guards: `permissionGuard('<permission>')` from `core/auth/permissions.ts`, `roleGuard`, `canMatchPermission`, `unsavedChangesGuard` (CanDeactivate), class-based `PatientOwnershipGuard` and `AdminRoleGuard`. Resolvers (functional): `core/guards/resolvers.ts`.
* **Preloading**: `SelectivePreloadingStrategy` (`core/services/routing-strategies.ts`) preloads only routes that declare `data.preload` (delay in ms) – after sign-in the commonly used areas load in the background.
* **Route reuse**: `ListReuseStrategy` keeps list pages alive (`data.reuse`) so filters/scroll survive a round trip to a detail page.

### Role / permission model
Six backend roles (ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF). `core/auth/permissions.ts` maps 24 permissions to roles (mirrors the gateway's rules, verified against the backend). It drives route guards, navigation visibility (`layouts/nav-items.ts`), the `*appHasPermission` / `*appRole` directives and button states. **The backend remains the authority** – the UI only avoids offering actions that would answer 403.

## 6. HTTP architecture
```
component ─▶ feature API service (core/api/*) ─▶ HttpClient ─▶ [loading → logging → error → retry → auth] ─▶ [CorrelationIdInterceptor] ─▶ gateway :30080
```
* `core/api/base-api.service.ts` – `BaseApiService` (URL building, typed `get/post/put/patch/remove`, `HttpParams` from objects) and a generic `CrudApiService<T, TInput>`.
* `HttpContextToken`s (`core/interceptors/http-context.ts`): `SKIP_AUTH`, `SILENT_ERRORS`, `SKIP_LOADING`, `RETRY_COUNT` let a call opt out of cross-cutting behaviour (e.g. polling must not flash the progress bar).
* **auth interceptor** – attaches `Bearer`, on 401 performs **one shared refresh** (`AuthService.refresh`, `shareReplay`) and replays the request; `defer()` reads the token at subscribe time so replays carry the new token.
* **error interceptor** – converts `HttpErrorResponse` into the typed `ApiError` (field errors parsed from the backend `details[]`) and raises a toast unless silenced.
* **retry interceptor** – idempotent GETs, exponential back-off for network errors and 502/503/504.
* Errors never reach templates as raw `HttpErrorResponse`; views receive `LoadState<T>` (`loading | loaded | error`) from `shared/utilities/load-state.ts`.

## 7. Authentication architecture
`core/auth/auth.service.ts` keeps `user`, `status` and `role` as **signals**. The access token lives **in memory only** (`token-store.service.ts`); the refresh token in `sessionStorage` because the backend returns it only in the JSON body (no HttpOnly cookie – documented limitation). Tokens rotate; the service therefore single-flights refresh. `core/services/session-manager.service.ts` renews the token before expiry and logs out after `idleLogoutMinutes` of inactivity (timers are cleaned up through `effect` cleanup).

## 8. State architecture
| Kind | Used for | Location |
|---|---|---|
| Component signals | view state, form state | components |
| Feature services with signals/RxJS | contexts, notification centre, theme | `core/services`, `features/*/*.service.ts` |
| NgRx Store (global/feature) | entity collections shared across pages: patients, doctors, appointments, billing, hospitals | `state/*` |
| NgRx Component Store | local, short-lived builder state: lab request builder | `state/feature-stores/lab-request.store.ts` |
| NgRx Signal Store | pharmacy inventory (entities + UI state + rxMethod) | `state/feature-stores/pharmacy.store.ts` |
Details and the rationale for each: [NGRX_IMPLEMENTATION.md](NGRX_IMPLEMENTATION.md).

## 9. UI architecture and library split
| Library | Modules | How it is isolated |
|---|---|---|
| Angular Material (M3, `mat.theme`) | patients, doctors, prescriptions, navigation, dialogs, snackbars | global theme in `src/styles/styles.scss` |
| Tailwind 3 | dashboard, appointments, notifications, profile, shared layout primitives | utilities (`preflight` on) |
| PrimeNG 19 (Aura) | laboratory, pharmacy, medical records | `providePrimeNG`, dark selector `.dark` |
| Bootstrap 5.3 | hospitals, billing | **only components + utilities are emitted under `.bs-scope`**, so Bootstrap utilities (`.d-flex`, `.card`…) cannot collide with Tailwind; variables and root custom properties are global |
Dark mode: `ThemeService` toggles the `dark` class / `color-scheme` and persists the choice; each library reads it through its own mechanism.

## 10. Performance decisions
`OnPush` + signals everywhere; zoneless; every feature lazy-loaded with a selective preloading strategy; `@defer` for below-the-fold/heavy blocks (dashboard widgets, medical-record timeline), CDK virtual scroll for the record timeline, `track` expressions on every `@for`, `shareReplay` caching of catalogue reads, request cancellation with `switchMap`, dynamic `import()` for prescription export. Production build: ~159 JS chunks, initial bundle **1.04 MB raw / 217 kB transferred**.

## 11. Isolated NgModule feature
`features/admin/admin.module.ts` – `@NgModule` with **non-standalone** components (`standalone: false`), `CommonModule`, `ReactiveFormsModule`, `RouterModule.forChild`, classic constructor DI, `@Output() EventEmitter`, `takeUntil(destroy$)` and `ChangeDetectorRef.markForCheck`. Everything else in the application is standalone.
