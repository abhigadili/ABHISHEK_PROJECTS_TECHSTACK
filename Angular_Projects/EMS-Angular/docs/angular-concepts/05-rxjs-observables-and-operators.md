# 05 · RxJS — Observables and operators

## 1. Concept explanation
An **Observable** is a lazy stream of values over time; a **Subscription** is one running execution; an **Observer** (`{ next, error, complete }`) receives values. **Operators** (used in `.pipe()`) transform, filter, combine or time streams. **Subjects** are observables you can push into. RxJS is used here for everything *asynchronous or event-shaped*: HTTP, debounced search, polling, cancellation, token-refresh coordination. (Plain UI state uses Signals — see 06.)

## 2. Angular API / syntax
```ts
this.http.get<T>(url).pipe(timeout(30000), retry({ count: 2, delay: (e, n) => isTransient(e) ? timer(300 * n) : throwError(() => e) }), catchError(…));
toSignal(obs$, { initialValue }) · toObservable(signal) · takeUntilDestroyed(destroyRef) · async pipe
```

## 3. Where each required operator/type is used in EMS (non-test code)
| Concept | Real use | File |
|---|---|---|
| Observable / Observer / Subscription | `subscribe({ next, error })` **observer objects** on every submit; explicit `Subscription` lifetimes via `takeUntil`/`takeUntilDestroyed` | `employee-form.component.ts`, `login.component.ts`, `live-clock.component.ts` |
| **Subject** | login submit stream; manual notification refresh; list reload trigger; clock teardown | `auth/login.component.ts` (`submit$`), `core/services/notification.service.ts` (`refresh$`), `layout/notification-menu.component.ts` (`reload$`), `shared/components/live-clock.component.ts` (`destroy$`) |
| **BehaviorSubject** | current online/offline state (always has a value, late subscribers get it) | `core/services/connectivity.service.ts` |
| **ReplaySubject(3)** | last auth events replayed to late subscribers | `core/services/auth.service.ts` (`events$`) |
| **AsyncSubject** | “session restore finished” — emits once on completion; guards wait for it | `auth.service.ts` (`sessionReady$`), `core/guards/guards.ts` |
| `pipe`, `map`, `filter`, `tap` | everywhere; e.g. envelope unwrapping `map(r => r.data)` | `core/services/api.service.ts` |
| **switchMap** | search-as-you-type, list reload, per-selection loads — cancels the previous request | `employee-list.store.ts`, `employee-select.component.ts`, `organization.component.ts`, `attendance.component.ts`, `notification.service.ts` (poll → request) |
| **mergeMap** | export all employee pages, **3 at a time** | `employee-list.component.ts` (`exportCsv`) |
| **concatMap** | strictly sequential “create employee → upload picture → save extras” and “apply leave → upload document” | `employee-form.component.ts`, `leave-apply.component.ts` |
| **exhaustMap** | ignore repeated login submits while one is in flight | `auth/login.component.ts` |
| **debounceTime** + **distinctUntilChanged** | search box, autocomplete, org search, report filters | `search-box.component.ts`, `employee-select.component.ts`, `organization.component.ts`, `report-panel.component.ts` |
| **combineLatest** | avatar reacts to id + has-picture + cache version | `shared/components/profile-picture.component.ts` |
| **forkJoin** | dashboard loads 4 independent calls; org detail loads chain + direct reports | `core/services/dashboard.service.ts`, `organization.component.ts` |
| **zip** | pair “my balances” with “leave type metadata” by emission order (paid/unpaid labels) | `leaves/leave-home.component.ts` |
| **merge** | `merge(timer(0, poll), refresh$)` for notifications; `merge(online, offline)` events | `notification.service.ts`, `connectivity.service.ts` |
| **startWith** | initial `loading` state for list pipelines | `employee-list.store.ts`, `department-list.component.ts`, … |
| **catchError** | convert HTTP failures into *state* (`{status:'error'}`) instead of killing the stream | `employee-list.store.ts`, `dashboard.service.ts` |
| **retry** (modern replacement for `retryWhen`) | back-off retry of *transient GET* failures only (network/5xx) | `api.service.ts` |
| **shareReplay** | cache reference lists; share the single in-flight token refresh; cache picture blobs | `reference-data.service.ts`, `auth.service.ts`, `picture.service.ts` |
| **take** / **takeUntil** / **takeUntilDestroyed** | `take(1)` after the email check settles; `takeUntil(destroy$)` + `ngOnDestroy` for the clock; `takeUntilDestroyed()` for component subscriptions | `employee-form.component.ts`, `live-clock.component.ts`, `search-box.component.ts`, `employee-list.component.ts` |
| **of / from / range** | `of(null)` fall-backs; `from(steps)` for sequential post-save steps; `range` of page numbers | `employee-form.component.ts`, `employee-list.component.ts` |
| **throwError** | rethrow normalised errors from interceptors/AuthService | `interceptors.ts`, `api.service.ts`, `auth.service.ts` |
| **iif** | issue manager-only requests only for managers | `dashboard.service.ts` |
| **timeout** | every API call fails after `apiTimeoutMs` | `api.service.ts` |
| **firstValueFrom / lastValueFrom** | `await` the session restore in guards; await the aggregated export | `core/guards/guards.ts`, `employee-list.component.ts` |
| Higher-order observables | all `switchMap/concatMap/mergeMap/exhaustMap` above | – |
| Cancellation | `switchMap` cancels HTTP (`HttpTestingController … cancelled` asserted in `employee-list.store.spec.ts`) | – |
| Error handling | `catchError` in state pipelines, `errorInterceptor`, per-form `AppError` | – |
| Subscription management | `toSignal` (auto-unsubscribes), `async` pipe (`leave-apply.component.ts`), `takeUntilDestroyed`, `takeUntil` + `ngOnDestroy` | – |

## 4. Relevant file paths
`src/app/core/services/{api,auth,notification,connectivity,dashboard,reference-data,picture}.service.ts`, `src/app/core/interceptors/interceptors.ts`, `src/app/features/employees/{employee-list.store,employee-form.component,employee-list.component}.ts`, `src/app/features/auth/login.component.ts`.

## 5. Practical implementation explanation (the stories behind the operators)
1. **Search employees (debounce + switchMap).** `SearchBoxComponent` debounces 300 ms and trims; the URL changes; `EmployeeListStore` turns the query signal into an observable and `switchMap`s to the API so a slow earlier response can never overwrite a newer one.
2. **Dashboard (forkJoin + iif).** `DashboardService.load()` fires attendance summary, balances, overview and approvals concurrently; `iif(() => canSeeOverview, …, of(null))` means employees never call manager-only endpoints (403s avoided, asserted in `dashboard.service.spec.ts`).
3. **Duplicate login prevention (exhaustMap).** While the login POST is in flight further submits are *dropped* — not queued (concatMap) and not cancelling (switchMap).
4. **Sequential writes (concatMap / from).** The employee must exist before its picture can be uploaded; `from(steps).pipe(concatMap(step => step()), toArray())` guarantees order.
5. **Bounded parallelism (mergeMap).** CSV export fetches page 1, then pages 2…N three at a time (`mergeMap(fn, 3)`), joined with `lastValueFrom`.
6. **Token refresh coordination.** The backend rotates refresh tokens and revokes the family on reuse, so N parallel 401s must trigger **one** refresh: `refreshAccessToken()` returns the same `shareReplay`ed observable to all callers (see 17).
7. **Notifications.** `toObservable(isAuthenticated).pipe(switchMap(auth => auth ? merge(timer(0, poll), refresh$).pipe(switchMap(fetchCount)) : of(0)))` — polling starts on login and stops on logout automatically.
8. **Avoid leaks.** Services use `shareReplay({refCount:false})` only for data that should live for the session; components use `toSignal`/`takeUntilDestroyed`.

## 6. Why this concept was selected
HTTP and user input are inherently asynchronous and cancellable; RxJS operators express “latest wins”, “ignore while busy”, “in order”, “in parallel with a limit” in one line each — behaviours that are bug-prone with promises.

## 7. Interview-related considerations
* **switchMap vs mergeMap vs concatMap vs exhaustMap** — latest wins & cancels / all in parallel / queue in order / ignore while busy. The app uses each where its semantics match the user story.
* *Cold vs hot?* `HttpClient` observables are cold (one request per subscription) — hence `shareReplay` to share. Subjects are hot.
* *`retryWhen` is deprecated* → `retry({ count, delay })`. Only retry idempotent GETs; never retry a POST blindly (the app retries only the `envelope()` GET path).
* *`forkJoin` vs `zip` vs `combineLatest`?* forkJoin: last values after all complete; zip: pairs by index; combineLatest: latest of each, re-emits on any change.
* *Memory leaks:* unsubscribe or use `takeUntilDestroyed`/`toSignal`/`async`. `shareReplay({ refCount:false })` keeps the source alive — deliberate for session-long caches.
* *Why catchError inside the inner observable?* So one failed request doesn't complete the outer `switchMap` stream (see `employee-list.store.ts`: `catchError` sits *inside* `switchMap`).
