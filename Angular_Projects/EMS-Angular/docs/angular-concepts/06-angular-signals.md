# 06 · Angular Signals

## 1. Concept explanation
A **signal** is a reactive value that notifies consumers when it changes. `computed()` derives values lazily and memoises them; `effect()` runs side effects when its dependencies change; `linkedSignal()` is writable state that **resets from a source**; `toSignal`/`toObservable` bridge RxJS. Signals make change detection fine-grained and remove most manual subscriptions.

## 2. Angular API / syntax
```ts
const user = signal<SessionUser | null>(null);          readonly isAuthenticated = computed(() => user() !== null);
readonly role = this._user.asReadonly();                  // expose read-only, mutate privately
readonly page = linkedSignal<Criteria, number>({ source: this.criteria, computation: () => 1 });
effect(() => { const v = prefs(); untracked(() => storage.set(v)); });
const items = toSignal(obs$, { initialValue: [] });       const obs$ = toObservable(querySignal);
readonly employee = input.required<Employee>();  readonly selected = output<Employee>();  readonly value = model('');
```

## 3. Where it is implemented in EMS
| API | Real use | File |
|---|---|---|
| `signal()` | auth state, UI flags (`saving`, `busy`), filters, expanded tree nodes | `auth.service.ts`, `organization.component.ts`, most components |
| `computed()` | `isAuthenticated`, `role`, `displayName`, permission set, dashboard stat cards & chart data, leave balance cards, `unreadCount`, `loading` | `auth.service.ts`, `permission.service.ts`, `dashboard.component.ts`, `leave-home.component.ts`, `notification.service.ts`, `loading.service.ts` |
| `effect()` | persist preferences; sync drawer with the saved preference; open first tree levels; scroll selection into view; push parent value into a child control | `preferences.service.ts`, `layout/shell.component.ts`, `organization.component.ts`, `search-box.component.ts` |
| `linkedSignal()` | **page resets to 1 when any filter changes** (`page`), **selection survives only while the person is in the results** (`selectedId`) | `employees/employee-list.store.ts` |
| `input()` / `input.required()` / `output()` / `model()` | component APIs everywhere; `model` in `SearchBoxComponent` | `shared/components/*` |
| `asReadonly()` | `AuthService.user/profile`, `PreferencesService.prefs`, `BreadcrumbService.crumbs` | `core/services/*` |
| `toSignal()` | every “load data for the screen” pipeline (28 files) | `employee-list.store.ts`, `dashboard`… |
| `toObservable()` | turn query signals into HTTP pipelines with `switchMap` (22 files) | `employee-list.store.ts`, `department-list.component.ts`, `notification.service.ts` |
| `untracked()` | inside effects that must not re-trigger on what they read | `preferences.service.ts`, `organization.component.ts`, `department-form.component.ts` |
| Signal state shared through services | auth, notifications count, loading counter, route-scoped `EmployeeDetailsState` | `core/services/*`, `employee-details.state.ts` |

Practical areas the brief names: **authentication state** (`AuthService`), **logged-in user** (`profile`, `displayName`), **employee filters** (`EmployeeListStore.criteria`), **selected employee** (`EmployeeListStore.selectedId`, `EmployeeDetailsState.employee`), **dashboard statistics** (`DashboardComponent.stats/headcountChart`), **notification count** (`NotificationService.unreadCount`), **loading & error state** (`LoadingService`, per-list `state`), **leave balance summaries** (`LeaveHomeComponent.cards`, `BalancesWidgetComponent.rows`), **organization chart selection** (`OrganizationComponent.selectedId/expanded/path`).

## 4. Relevant file paths
`src/app/core/services/auth.service.ts`, `src/app/features/employees/employee-list.store.ts`, `src/app/features/dashboard/dashboard.component.ts`, `src/app/core/services/notification.service.ts`, `src/app/features/organization/organization.component.ts`.

## 5. Practical implementation explanation
* **State machine in one signal.** `EmployeeListStore.state` is a `toSignal` over `switchMap(query → http)` with `startWith({status:'loading'})` and `catchError → {status:'error'}`; `items`, `meta`, `loading`, `error` are `computed` slices — no duplicated booleans to keep in sync.
* **`linkedSignal` for “reset on change”.** `page` is writable (the URL sets it) yet automatically falls back to 1 whenever `criteria` changes; `applyParams` only touches signals that really differ so a pure page change doesn't reset anything. Tests: `employee-list.store.spec.ts`.
* **Derived, not stored.** Dashboard stat cards/chart datasets/widgets are `computed` from the single `data` signal; role → permission set is `computed` from `AuthService.role`.
* **Effects only for side effects.** Persisting preferences to `localStorage`, scrolling the DOM and driving `MatSidenav` are effects; every *value* is `computed`.
* **Where signals vs RxJS** (decision rule): *synchronous UI/session state → signals*; *asynchronous, cancellable or time-based flows → RxJS*; cross over with `toSignal`/`toObservable` at the boundary, **not for the same responsibility** (e.g. auth *state* is a signal; the *refresh request* is an observable).

## 6. Why this concept was selected
The brief asks for Signals + RxJS without NgRx. Signals give OnPush-friendly, glitch-free derived state; RxJS stays where its operators matter. `linkedSignal` removes a whole class of “forgot to reset the page” bugs.

## 7. Interview-related considerations
* *signal vs BehaviorSubject?* Signals are synchronous, always have a value, glitch-free, and need no subscription management; BehaviorSubject is a stream (use when you need operators/time).
* *`computed` vs `effect`?* computed returns a value and is pure; effect performs side effects and should not set signals used for derivation (avoid ping-pong).
* *Why `untracked` in an effect?* To read signals without making them dependencies (persisting a value shouldn't re-run when storage changes).
* *When does `toSignal` unsubscribe?* When the injection context is destroyed; it must be called in an injection context (field initialiser/constructor).
* *Testing effects:* component-scoped effects run during change detection (`fixture.detectChanges()`), root effects with `TestBed.flushEffects()` — learned the hard way in `attendance.component.spec.ts`.
* *`linkedSignal` vs `computed` + writable signal?* `linkedSignal` is writable *and* recomputes from its source, preserving the previous value in the computation (`previous?.value`) — used for the selection.
