# NgRx Implementation

NgRx **19.2** (`@ngrx/store`, `effects`, `entity`, `router-store`, `store-devtools`, `component-store`, `signals`, `operators`). Five domains use the global Store, one uses a **Component Store**, one a **Signal Store** – each chosen on purpose (§9).

## 1. Store configuration (root + feature)
| Concept | File |
|---|---|
| `provideStore`, runtime checks (strict state/action immutability), `provideEffects()`, `provideRouterStore()`, `provideStoreDevtools()` | `src/app/state/index.ts` (`provideAppState()` – spread into `src/app/app.config.ts`) |
| **Root-registered** feature slices (shared by many routes: dashboard, header, booking) | `src/app/state/index.ts` → `appointmentsFeature`, `hospitalsFeature` |
| **Lazy feature slices** via route providers (`provideState` + `provideEffects`) | `src/app/features/patients/patients.routes.ts`, `src/app/features/doctors/doctors.routes.ts`, `src/app/features/billing/billing.routes.ts` |
| Initial state + state interfaces | `src/app/state/entities/*.entity.ts` (e.g. `src/app/state/entities/billing.entity.ts`) |
| Immutable updates | all reducers spread state; enforced by `strictStateImmutability`/`strictActionImmutability` |
| DevTools | `provideStoreDevtools({ maxAge: 30, logOnly: !isDevMode() })` – Redux DevTools shows every action, state diff and time travel in development |

## 2. Actions
| Technique | File |
|---|---|
| `createAction` + `props<>()`, empty actions, UI actions | `src/app/state/actions/doctors.actions.ts` |
| `createActionGroup` (source-prefixed, typed event map) | `src/app/state/actions/patients.actions.ts`, `src/app/state/actions/billing.actions.ts`, `src/app/state/actions/appointments.actions.ts`, `src/app/state/actions/hospitals.actions.ts` |
| Naming convention | `[Source] Event` (`[Doctors Page] Load Doctors`, `Billing/Pay Success`) – describes *what happened*, not the setter |

## 3. Reducers and `createFeature`
| Technique | File |
|---|---|
| `createReducer` + `on(...)` | `src/app/state/reducers/doctors.reducer.ts` |
| `createFeature` (auto-generated feature selectors) | `src/app/state/reducers/billing.reducer.ts` (`billingFeature`), `src/app/state/reducers/appointments.reducer.ts`, `src/app/state/reducers/hospitals.reducer.ts` |
| **Optimistic update with rollback** | `src/app/state/reducers/appointments.reducer.ts` – cancelling flags the entity `CANCELLED` immediately, stores the previous status in `rollback`, restores it on failure |
| Multiple actions → one handler, loading/saving/error flags | `src/app/state/reducers/billing.reducer.ts` |
| **Normalised state** | `src/app/state/entities/hospitals.entity.ts` – hospitals and departments are two entity collections linked by `hospitalId` |

## 4. NgRx Entity
`createEntityAdapter` with `sortComparer`/`selectId` per domain: `src/app/state/entities/patients.entity.ts`, `doctors.entity.ts`, `appointments.entity.ts`, `billing.entity.ts`, `hospitals.entity.ts`. Adapter operations in use: `setAll`, `addOne`, `upsertOne`, `upsertMany`, `updateOne`, `updateMany`, `removeOne`, `removeMany`, `removeAll` (see the reducers above; e.g. `removeMany` in `src/app/state/reducers/patients.reducer.ts`, `updateMany` in `src/app/state/reducers/appointments.reducer.ts`). Entity selectors (`selectAll`, `selectEntities`, `selectTotal`) are built with `adapter.getSelectors(featureSelector)` in `src/app/state/selectors/*.selectors.ts`.

## 5. Selectors
| Technique | File |
|---|---|
| Feature selectors, memoised `createSelector` composition | `src/app/state/selectors/billing.selectors.ts` (`selectVisibleBills` → `selectPayableBills` → `selectSelectedBills`; `selectOutstanding`, `selectCollected`, `selectBillCounts`) |
| **Parameterised selectors** (factory functions) | `src/app/state/selectors/doctors.selectors.ts` (`selectDoctorById(id)`), `src/app/state/selectors/hospitals.selectors.ts` (`selectDepartmentsOf(hospitalId)`), `src/app/state/selectors/billing.selectors.ts` (`selectBillPayments(billId)`) |
| Derived UI models (filter + sort + page + compare) | `src/app/state/selectors/doctors.selectors.ts` (`selectFilteredDoctors` → `selectDoctorPage`) |
| **Router-based selectors** (route param joined with entities) | `src/app/state/selectors/router.selectors.ts` + `selectRoutedBill`, `selectRoutedDoctor`, `selectRoutedPatient`, `selectRoutedAppointment`, `selectRoutedHospital` |
| Selector → Signal | `store.selectSignal(...)` in `src/app/features/billing/billing-invoices.component.ts`, `src/app/features/billing/billing-details.component.ts` |

## 6. Effects
Both styles are used deliberately.

**Class-based effects** (`@Injectable` + `createEffect`): `src/app/state/effects/patients.effects.ts`, `appointments.effects.ts`, `billing.effects.ts`, `hospitals.effects.ts`.
**Functional effects** (`createEffect(() => …, { functional: true })`, `inject()` in default params): `src/app/state/effects/doctors.effects.ts`.

| Flattening operator | Used for |
|---|---|
| `switchMap` | list loading / filter changes – a newer request cancels the older (`doctors.effects.ts` `loadDoctors$`, `billing.effects.ts` `loadStaff$`) |
| `mergeMap` | independent parallel lookups (`doctors.effects.ts` `loadDoctor$`, `billing.effects.ts` `loadOne$`, `loadPayments$`) |
| `concatMap` | ordered, queued writes: bill generation/cancel, doctor update (`billing.effects.ts`), **sequential settlement of several invoices** (`settle$` – pay then confirm, one invoice after the other, failures isolated per invoice with `catchError`, results collected with `toArray`) |
| `exhaustMap` | duplicate-submit protection: payment (`pay$` – a second click while a payment runs is ignored → no double charge), doctor creation, patient registration |
| `withLatestFrom` | reading current state inside an effect (`doctors.effects.ts`, `hospitals.effects.ts`) |
| Non-dispatching effects (`{ dispatch: false }`) | toasts (`billing.effects.ts` `toasts$`), persistence of doctor-list preferences (`doctors.effects.ts` → `persistFilters` in `src/app/state/entities/doctors.entity.ts`) |
| Error handling | every effect catches inside the inner pipe (`catchError` → failure action) so the effect stream never dies |

## 7. Router Store
`provideRouterStore()` + `routerReducer` in `src/app/state/index.ts`; `getRouterSelectors()` in `src/app/state/selectors/router.selectors.ts`. Detail pages read the id from the store (`selectRouteParam('billId')` etc.) rather than from `ActivatedRoute`.

## 8. State persistence
Doctor-list UI preferences (specialization, department, only-active, sort key/direction, page size) are persisted to `localStorage` by an effect and rehydrated as initial state: `src/app/state/entities/doctors.entity.ts` (`persistFilters`, load function) + `src/app/state/effects/doctors.effects.ts`. Entity data is **not** persisted (always fresh from the API). Pharmacy pinned medicines are persisted by the Signal Store (below).

## 9. Component Store and Signal Store – and when to use which
| Store | File | Why |
|---|---|---|
| **Component Store** `LabRequestStore` | `src/app/state/feature-stores/lab-request.store.ts` (provided in `providers` of `src/app/features/laboratory/lab-request-new.component.ts`) | The lab-request builder state (catalogue, chosen patient/doctor/priority/tests, submit outcomes) is needed by one screen only; a component-scoped store is created and destroyed with it. Uses `select`, `updater`, `effect` (+ `tapResponse` from `@ngrx/operators`), `forkJoin` for one POST per test inside an `exhaustMap` |
| **Signal Store** `PharmacyStore` | `src/app/state/feature-stores/pharmacy.store.ts` (root, `providedIn: 'root'`) | Inventory is shared by list/details/orders pages and is naturally signal-shaped: `withEntities`, `withState` (search, stock filter, sort, paging, pinned), `withComputed` (filtered, pages, pageRows, counts, lowStock), `withMethods` (+ `rxMethod` for `load` with `switchMap` and **optimistic `restock`** with rollback), `withHooks.onInit` (loads data, restores pinned ids) |
| **Global Store** | `src/app/state/**` | Collections that many pages read/write, that need devtools traceability, optimistic flows and cross-feature effects: patients, doctors, appointments, billing, hospitals |
Rule of thumb applied: *shared + traceable ⇒ global Store; one screen's transient state ⇒ Component Store; signal-native shared state without ceremony ⇒ Signal Store*.

## 10. Facade
`src/app/features/appointments/appointment-feed.facade.ts` hides actions/selectors/identity resolution from components (they use signals + `load()`); `src/app/features/patients/patient-context.service.ts` and `src/app/features/doctors/doctor-context.ts` expose page-scoped contexts.

## 11. What is intentionally *not* in the Store
Form state, dialog open/close, per-request `LoadState`s (`toLoadState`), notification feed (RxJS service), authentication (signals in `AuthService`). Keeping these out avoids boilerplate without losing traceability for domain data.
