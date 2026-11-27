# RxJS Implementation

RxJS **7.8**. Observables are used where the problem is a *stream over time* (HTTP, typing, polling, events, cancellation); results are converted to signals at the template boundary with `toSignal` ([SIGNALS_IMPLEMENTATION.md](SIGNALS_IMPLEMENTATION.md)). Every operator below is used for a concrete healthcare reason; paths are exact.

## 1. Core concepts
| Concept | Where |
|---|---|
| Observable / Observer / Subscription | every API call: `src/app/core/api/base-api.service.ts`; manual subscription with teardown: `src/app/features/admin/admin-users.component.ts` |
| Cold observables (one request per subscriber) | all `HttpClient` calls in `src/app/core/api/*.ts` |
| **Hot / multicast** (`shareReplay`, Subjects) | `src/app/core/services/notification-center.service.ts` (`feed$`), `src/app/core/services/current-identity.service.ts`, `src/app/core/auth/auth.service.ts` (single-flight refresh) |
| Subscription management | `takeUntilDestroyed()` (modern) in `src/app/features/prescriptions/prescription-generate.component.ts`; `takeUntil(destroy$)` + `ngOnDestroy` (classic) in `src/app/features/admin/admin-users.component.ts` |
| Observable lifecycle (`finalize`) | `src/app/features/patients/patient-register.component.ts`, `src/app/core/interceptors/loading.interceptor.ts` |

## 2. Subjects
All four kinds in one service, `src/app/core/services/event-bus.service.ts`:
* `Subject` – fire-and-forget domain events (`events$`: patient-registered, payment-completed…).
* `BehaviorSubject` – current value for late subscribers (`lastActivity$`, shown in the header); also `src/app/core/services/notification-center.service.ts` (`readIds$`, read state of notifications) and reload triggers such as `reload$` in `src/app/features/laboratory/lab-catalogue.component.ts`.
* `ReplaySubject(20)` – the last 20 events for components that mount later (activity feed).
* `AsyncSubject` – emits only the final value on completion (`bootCompleted$`, one-shot "application ready").
Other Subject uses: duplicate-protected submit streams (`submit$` in `src/app/features/prescriptions/prescription-generate.component.ts`, `src/app/features/patients/patient-register.component.ts`); toast stream `src/app/core/services/notification.service.ts`; manual refresh trigger in `src/app/core/services/notification-center.service.ts`.

## 3. Creation operators
| Operator | Where / why |
|---|---|
| `of()` | fallbacks inside `catchError`, e.g. `src/app/features/dashboard/dashboard.service.ts` |
| `from()` | iterate invoices one by one: `src/app/state/effects/billing.effects.ts` (`settle$`) |
| `interval()` | countdown to an appointment: `src/app/shared/utilities/countdown.ts` (used by `src/app/features/appointments/appointment-details.component.ts`) |
| `timer()` | polling: `src/app/core/services/notification-center.service.ts` (every 30 s), `src/app/features/pharmacy/pharmacy-orders.component.ts` (15 s), `src/app/features/prescriptions/prescription-details.component.ts` (status every 10 s); retry back-off in `src/app/core/interceptors/retry.interceptor.ts`; preload delay in `src/app/core/services/routing-strategies.ts` |
| `forkJoin()` | many dashboard widgets in parallel: `src/app/features/dashboard/dashboard.service.ts`; patient overview tabs `src/app/features/patients/patient-tabs.component.ts`; one lab POST per selected test `src/app/state/feature-stores/lab-request.store.ts` |
| `combineLatest()` | filters + paging + reload → one request stream: `src/app/features/appointments/appointment-list.component.ts`, `src/app/features/prescriptions/prescription-list.component.ts`, `src/app/features/laboratory/lab-requests.component.ts`, `src/app/features/pharmacy/pharmacy-orders.component.ts`; unread count = feed × read ids in `src/app/core/services/notification-center.service.ts` |
| `merge()` | polling timer **or** manual refresh: `src/app/core/services/notification-center.service.ts` |
| `concat()` | stale-while-revalidate: cached dashboard figures first, then fresh data: `src/app/features/dashboard/dashboard.component.ts` |
| `zip()` | per-doctor "free slots today", emitted together in order: `src/app/features/doctors/doctor-compare-dialog.component.ts` |
| `defer()` | read the bearer token at subscription time (so retries/replays carry the new token): `src/app/core/interceptors/auth.interceptor.ts` |
| `EMPTY` | "nothing to emit" (cancelled confirmation, missing cache): `src/app/features/prescriptions/prescription-details.component.ts`, `src/app/features/dashboard/dashboard.component.ts` |
| `throwError()` | typed failures: `src/app/core/interceptors/auth.interceptor.ts`, `src/app/features/patients/patient-register.component.ts` |

## 4. Transformation operators
| Operator | Where / why |
|---|---|
| `map` | response → view model everywhere, e.g. `src/app/features/prescriptions/prescription-list.component.ts` |
| **`switchMap`** | *latest wins*: availability when doctor/date changes (`src/app/features/appointments/appointment-book.component.ts`, `appointment-availability.component.ts`), search (`src/app/shared/components/patient-picker.component.ts`), refresh (`src/app/features/dashboard/dashboard.component.ts`), NgRx list effects. A stale request is **cancelled** by the browser |
| **`mergeMap`** | independent parallel work: `src/app/state/effects/doctors.effects.ts` (`loadDoctor$`), `src/app/state/effects/billing.effects.ts`, preloading in `src/app/core/services/routing-strategies.ts` |
| **`concatMap`** | ordered/sequential calls: register → login → create profile (`src/app/features/patients/patient-register.component.ts`); pay → confirm for each invoice (`src/app/state/effects/billing.effects.ts` `settle$`); queued writes |
| **`exhaustMap`** | ignore re-submits while one is in flight: booking and payments in `src/app/state/effects/appointments.effects.ts` / `billing.effects.ts` (`pay$`), prescription save `src/app/features/prescriptions/prescription-generate.component.ts`, registration |
| `scan` | accumulate upload progress and stop at completion: `src/app/core/services/file.service.ts` |
| `startWith` | initial value for `toSignal`/`combineLatest` streams: `src/app/features/billing/billing-generate.component.ts` (live invoice total), `src/app/shared/utilities/load-state.ts` (`loading`) |
| `withLatestFrom` | read state inside effects: `src/app/state/effects/doctors.effects.ts`, `src/app/state/effects/hospitals.effects.ts` |
| `pairwise` | previous → current URL of each navigation: `src/app/core/services/navigation-events.service.ts` |
| `toArray` | collect the results of the sequential settlement: `src/app/state/effects/billing.effects.ts` |

## 5. Filtering operators
| Operator | Where / why |
|---|---|
| `filter` | only finished navigations (`src/app/core/services/navigation-events.service.ts`), ignore empty ids (`src/app/features/appointments/appointment-details.component.ts`) |
| `take` / `first` | complete a stream: `src/app/features/appointments/appointment-feed.facade.ts` (`take(1)`), class guard must complete (`first()` in `src/app/core/guards/patient-ownership.guard.ts`) |
| `takeUntil` | classic teardown: `src/app/features/admin/admin-users.component.ts` |
| `takeUntilDestroyed` | modern teardown (injection-context aware): `src/app/features/prescriptions/prescription-generate.component.ts`, `src/app/features/prescriptions/prescription-details.component.ts` |
| **`debounceTime`** | doctor search (`src/app/features/doctors/doctor-list.component.ts`), debounced search box (`src/app/shared/components/search-box.component.ts`, 350 ms), patient picker (`src/app/shared/components/patient-picker.component.ts`) |
| **`distinctUntilChanged`** | do not re-query for the same text/ids: `src/app/shared/components/patient-picker.component.ts`, `src/app/shared/components/search-box.component.ts`, `src/app/features/appointments/appointment-feed.facade.ts` |
| `skip` | ignore the initial value of a model: `src/app/shared/components/search-box.component.ts` |
| `takeWhile` | stop the countdown when the appointment starts: `src/app/shared/utilities/countdown.ts` |

## 6. Utility and side-effect operators
| Operator | Where / why |
|---|---|
| `tap` | set loading flags / persist: `src/app/features/dashboard/dashboard.component.ts`, `src/app/features/prescriptions/prescription-generate.component.ts` |
| `delay` | retry back-off inside `retry({ delay })`: `src/app/core/interceptors/retry.interceptor.ts`, `src/app/core/services/notification-center.service.ts` |
| `timeout` | a slow dashboard widget must not block the page (6 s): `src/app/features/dashboard/dashboard.service.ts` |
| **`finalize`** | reset the *saving* flag whether the request succeeds or fails: `src/app/features/prescriptions/prescription-generate.component.ts`, `src/app/features/patients/patient-register.component.ts`; decrement the global loading counter in `src/app/core/interceptors/loading.interceptor.ts` |
| **`shareReplay`** | API caching: the pharmacy catalogue is fetched once for autocomplete *and* async validators (`src/app/features/prescriptions/prescription.service.ts`); current patient/doctor profile (`src/app/core/services/current-identity.service.ts`); the single in-flight token refresh (`src/app/core/auth/auth.service.ts`) |
| **`retry`** | idempotent GETs with exponential back-off (`src/app/core/interceptors/retry.interceptor.ts`); notification polling (`src/app/core/services/notification-center.service.ts`) |
| **`catchError`** | failure → state instead of a dead stream: `src/app/shared/utilities/load-state.ts` (`toLoadState`), NgRx effects (`src/app/state/effects/*.ts`), per-widget fallback in `src/app/features/dashboard/dashboard.service.ts`, per-invoice isolation in `settle$` |

## 7. Error handling and recovery
* Global: `src/app/core/interceptors/error.interceptor.ts` → `ApiError` (`src/app/core/models/api-error.ts`), `src/app/core/services/app-error-handler.ts` (`ErrorHandler` for uncaught errors).
* Recovery strategies: retry (GET), refresh-and-replay on 401 (`src/app/core/interceptors/auth.interceptor.ts`), fallback value (`catchError → of(null)` → "n/a" widget), isolate failures in batches (settlement and lab ordering keep going after a failed item), user-driven retry button (`retry` output of `src/app/shared/components/state-views.component.ts`).
* View contract: `LoadState<T>` (`loading | loaded | error`) from `src/app/shared/utilities/load-state.ts` – no component handles a raw `HttpErrorResponse`.

## 8. The 16 practical scenarios of the specification
| # | Scenario | Implementation |
|---|---|---|
| 1 | Doctor search with `debounceTime()` | `src/app/features/doctors/doctor-list.component.ts` |
| 2 | Patient search with `distinctUntilChanged()` | `src/app/shared/components/patient-picker.component.ts` |
| 3 | Booking with `exhaustMap()` against duplicate submissions | `src/app/state/effects/appointments.effects.ts` (book effect) |
| 4 | Availability with `switchMap()` | `src/app/features/appointments/appointment-book.component.ts` |
| 5 | Several dashboard APIs with `forkJoin()` | `src/app/features/dashboard/dashboard.service.ts` |
| 6 | Patient + appointment info with `combineLatest()` | `src/app/features/appointments/appointment-list.component.ts` |
| 7 | Notification streams with `BehaviorSubject` (backend has no push → polling) | `src/app/core/services/notification-center.service.ts` |
| 8 | Appointment status changes with Subject/BehaviorSubject | `src/app/core/services/event-bus.service.ts`, `src/app/features/appointments/appointment-details.component.ts` |
| 9 | Cancel previous API requests with `switchMap()` | `src/app/state/effects/doctors.effects.ts` (`loadDoctors$`) and all search/availability streams |
| 10 | Cleanup with `takeUntilDestroyed()` | `src/app/features/prescriptions/prescription-details.component.ts` |
| 11 | API caching with `shareReplay()` | `src/app/features/prescriptions/prescription.service.ts` |
| 12 | Error handling with `catchError()` | `src/app/shared/utilities/load-state.ts` |
| 13 | API retry with `retry()` | `src/app/core/interceptors/retry.interceptor.ts` |
| 14 | Loading state with `finalize()` | `src/app/core/interceptors/loading.interceptor.ts` |
| 15 | Sequential calls with `concatMap()` | `src/app/features/patients/patient-register.component.ts`, `src/app/state/effects/billing.effects.ts` |
| 16 | Parallel calls with `mergeMap()` / `forkJoin()` | `src/app/state/effects/doctors.effects.ts`, `src/app/features/dashboard/dashboard.service.ts` |

## 9. Not used on purpose
`race`, `buffer*`, `groupBy`, `throttleTime`, `auditTime` are not in the specification's operator list and no screen needed them; they were not added artificially.
