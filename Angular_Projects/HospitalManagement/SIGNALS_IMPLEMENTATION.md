# Signals Implementation

Angular **19.2** (the newest line supported by Node 20.11). Signals are the default reactivity model: all components are `OnPush` and the app runs **zoneless**, so a view only refreshes when a signal it read changes (or an event/`markForCheck`-equivalent occurs). RxJS stays where streams are the natural model (HTTP, debounce, polling) and is bridged with `toSignal` / `toObservable`.

Version note: in 19.2 `resource()`/`rxResource()`/`linkedSignal()` are **developer preview**, `effect()` is stable, and *official* signal-based forms do not exist yet (they arrive in later versions). Hence a small purpose-built signal form (§8).

## 1. `signal()` / `computed()` / `effect()` / `untracked()`
| API | Where & why |
|---|---|
| `signal()` | `src/app/core/auth/auth.service.ts` (user, status), `src/app/core/services/theme.service.ts` (mode), `src/app/core/services/loading.service.ts` (in-flight counter), `src/app/features/prescriptions/prescription-generate.component.ts` (patient, saving, error, result) |
| `computed()` | `src/app/core/auth/auth.service.ts` (`role`, `isAuthenticated`), `src/app/features/prescriptions/prescription-list.component.ts` (data source selection by role), `src/app/features/pharmacy/pharmacy-medicine-details.component.ts` (availability label) |
| `effect()` (+ cleanup) | `src/app/core/services/session-manager.service.ts` – renewal timer and idle listeners are (re)registered when the session changes and removed in `onCleanup`; `src/app/core/services/theme.service.ts` – applies theme to `<html>` and persists it |
| `effect()` reacting to inputs | `src/app/features/prescriptions/prescription-generate.component.ts` (pre-select patient/doctor from query params), `src/app/features/notifications/notification-details.component.ts` (mark read when loaded) |
| `untracked()` | `src/app/features/dashboard/dashboard.component.ts` (reload the appointment feed when the role changes without depending on facade internals); `src/app/features/billing/billing-invoices.component.ts` (see below) |
| Effect dependencies explained | `src/app/features/billing/billing-invoices.component.ts`: the effect depends only on the **primitive key** `status|page`. The filter *object* is replaced by the very action the effect dispatches; tracking it directly caused an infinite loop (found by the live test) – the fix is `computed` key + `untracked` dispatch |
| Derived computed chains | `src/app/state/feature-stores/pharmacy.store.ts` (`filtered → pages → pageRows` computed chain) |

## 2. Signal inputs, outputs, `model()`, queries
| API | Where |
|---|---|
| `input()` / `input.required()` | `src/app/features/prescriptions/prescription-view.component.ts`, `src/app/features/prescriptions/prescription-details.component.ts` (route param `id` bound by `withComponentInputBinding`) |
| Input alias / transform from query params | `src/app/features/prescriptions/prescription-generate.component.ts` (`input<string>(undefined, { alias: 'patientId' })`) |
| Route **data** → input | `src/app/features/laboratory/lab-requests.component.ts` (`view`), `src/app/features/notifications/notification-list.component.ts` (`unread`) |
| `output()` | `src/app/shared/components/pager.component.ts` |
| `outputFromObservable()` | `src/app/shared/components/search-box.component.ts` (debounced search stream as an output) |
| `model()` | `src/app/shared/components/patient-picker.component.ts` (`[(patient)]`), `src/app/features/patients/patient-contact.component.ts` |
| `viewChild()` / `viewChild.required()` / `viewChildren()` | `src/app/shared/components/file-dropzone.component.ts` (hidden file input), `src/app/features/patients/patient-form.component.ts` |
| `contentChild()` / `contentChildren()` | `src/app/shared/components/state-views.component.ts` (projected `#loaded` template), `src/app/shared/components/tabs.component.ts` (tab panels) |

## 3. `linkedSignal()` – derived but writable state
Used where a user choice must **reset automatically** when its source changes:
* `src/app/features/appointments/appointment-book.component.ts` – the chosen time slot resets when the doctor or date changes.
* `src/app/features/appointments/appointment-reschedule.component.ts` – same for rescheduling.
* `src/app/features/doctors/doctor-tabs.component.ts` – availability tab: picked slot resets with the `{doctorId, date}` request.

## 4. `resource()` and `rxResource()` (independent use cases only)
The spec asks not to force resources into every API call, so conventional API calls use `HttpClient` + RxJS (`toLoadState`). Resources are used where a *signal request → async value* model is a natural fit:
* `resource()` (Promise loader via `firstValueFrom`) – `src/app/features/doctors/doctor-tabs.component.ts` (slots + booked appointments for a doctor/date, both reacting to the same signal request).
* `rxResource()` (Observable loader, request cancelled when the signal changes) – `src/app/features/medical-records/patient-record.component.ts` (summary, patient), `src/app/features/medical-records/record-entry.component.ts` (entry), `src/app/features/medical-records/medical-documents.component.ts` (lab requests of the selected patient).
They expose `value()`, `isLoading()`, `error()`, `reload()` and are consumed directly in templates.

## 5. Signal ↔ RxJS interoperability
| Direction | Where |
|---|---|
| `toSignal()` (RxJS → Signal) | `src/app/features/laboratory/lab-catalogue.component.ts` (reload `BehaviorSubject` → `switchMap` → `toLoadState` → signal), `src/app/core/services/notification-center.service.ts` (`unreadCount`), `src/app/features/laboratory/lab-request-new.component.ts` (`toSignal(store.vm$, { requireSync: true })` for a Component Store view-model) |
| `toObservable()` (Signal → RxJS) | `src/app/features/prescriptions/prescription-list.component.ts` (`combineLatest` of source signals), `src/app/features/laboratory/lab-requests.component.ts`, `src/app/core/services/current-identity.service.ts` (user id → profile lookups) |
| Explicit injection context | `src/app/features/appointments/appointment-feed.facade.ts` (`runInInjectionContext(EnvironmentInjector, …)` because `toObservable` is called from an effect) – a bug found by the live test |
| `takeUntilDestroyed()` | `src/app/features/prescriptions/prescription-generate.component.ts`, `src/app/features/prescriptions/prescription-details.component.ts` |
| RxJS-based async state as a signal | `src/app/shared/utilities/load-state.ts` – `toLoadState()` yields `LoadState<T>` consumed as a signal by `src/app/shared/components/state-views.component.ts` |

## 6. Signals in services (state containers)
`AuthService` (identity), `ThemeService`, `LoadingService`, `NavigationEventsService` (`navigating`, `previousUrl`), `NotificationCenterService.unreadCount`, `PharmacyStore` (NgRx Signal Store, see [NGRX_IMPLEMENTATION.md](NGRX_IMPLEMENTATION.md)), `store.selectSignal()` usages in `src/app/features/billing/*.ts` (NgRx selector → signal).

## 7. Signals in templates
`@if (signal(); as value)` aliasing, `@let`, `@for` over signal arrays with `track`, `@defer (on viewport)` with signal-driven content – e.g. `src/app/features/dashboard/dashboard.component.ts`. No `async` pipe is needed anywhere: observables are converted once with `toSignal`.

## 8. Signal-based forms
`src/app/shared/utilities/signal-form.ts` implements `SignalField<T>` (value, touched, error, dirty, visibleError – all `signal`/`computed`) and `SignalForm` (`values`, `errors`, `valid`, `dirty`, `submitting`, `submit(handler)`, `reset()`) with pure validator functions (`required`, `minNumber`, `maxLength`, `emailFormat`). It is used by the **pharmacy** module, deliberately separate from the Reactive/Template-driven forms used elsewhere:
* `src/app/features/pharmacy/pharmacy-medicine-form.component.ts` – create/edit medicine (text + PrimeNG `p-inputnumber` bound with `[ngModel]`/`(ngModelChange)` to signals).
* `src/app/features/pharmacy/pharmacy-medicine-details.component.ts` – restock quantity with inline validation.

## 9. Signals and change detection
Because the app is zoneless, anything that mutates state outside a signal/event/`async` boundary would not render. The rule followed everywhere: state changes go through signals (or NgRx selectors converted to signals); the only classic component, `src/app/features/admin/admin-users.component.ts`, calls `ChangeDetectorRef.markForCheck()` explicitly after subscriptions complete.
