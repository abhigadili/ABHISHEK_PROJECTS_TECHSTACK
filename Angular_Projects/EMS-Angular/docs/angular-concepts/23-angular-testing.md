# 23 · Angular testing

## 1. Concept explanation
Three layers: **unit tests** (pure functions, pipes, validators, services with `HttpTestingController`), **component tests** (TestBed + real templates, mocked HTTP) and **E2E tests** (Playwright driving a real browser against the *real* Express/MySQL backend). Each layer catches different bugs — this project found real defects at every level (listed below).

## 2. Tooling and commands
| Layer | Tool | Command |
|---|---|---|
| Unit + component | Jasmine / Karma, headless Chrome (`karma.conf.js`, custom `ChromeHeadlessNoSandbox`) | `CHROME_BIN=/usr/bin/google-chrome npm test` |
| E2E | Playwright (`playwright.config.ts`), `E2E_CHANNEL=chrome` uses installed Chrome | `npm run e2e` (needs the test backend — README) |
| Lint | `angular-eslint` flat config | `npm run lint` |

Helpers: `src/testing/test-helpers.ts` — `provideTestApp()` (HttpClient + testing backend + router + noop animations + in-memory storages), `respond()/failWith()/envelope()/meta()`, `MemoryStorage`.

## 3. Where each required test lives (194 unit/component tests + 24 Playwright E2E tests)
| Brief item | Spec |
|---|---|
| **Component** — Login | `features/auth/login.component.spec.ts` (invalid form, **exhaustMap single request**, retry after failure) |
| Dashboard | `features/dashboard/dashboard.component.spec.ts` (manager vs employee, chart computed from API data, retryable error) |
| Employee listing | `features/employees/employee-list.component.spec.ts` (+ `employee-list.store.spec.ts`: linkedSignal paging reset, cancellation) |
| Employee create/edit forms | `features/employees/employee-form.component.spec.ts` |
| Department forms | `features/departments/department-form.component.spec.ts` |
| Attendance | `features/attendance/attendance.component.spec.ts` |
| Leave application | `features/leaves/leave-apply.component.spec.ts` |
| Organization chart | `features/organization/organization.component.spec.ts` |
| Notification components | `layout/notification-menu.component.spec.ts`, `core/services/notification.service.spec.ts` |
| **Services** — Auth | `core/services/auth.service.spec.ts` (shared refresh, restore, logout, ReplaySubject/AsyncSubject) |
| Employee, Department, Attendance, Leave, Organization | `core/services/{employee,department,attendance,leave,organization}.service.spec.ts` |
| **Concepts** — pipes | `shared/pipes/pipes.spec.ts` |
| directives | `shared/directives/directives.spec.ts` |
| validators | `shared/validators/validators.spec.ts` (sync, async with `fakeAsync`, cross-field, conditional) |
| FormArray / FormBuilder | `features/employees/employee-form.factory.spec.ts` |
| ControlValueAccessor | `shared/components/employee-select.component.spec.ts` |
| Signals state | `employee-list.store.spec.ts`, `core/services/preferences-permission.spec.ts`, `notification.service.spec.ts` |
| RxJS transformations | `reference-data.service.spec.ts` (shareReplay), `dashboard.service.spec.ts` (forkJoin/iif), `search-box.component.spec.ts` (debounce/distinct), `picture.service.spec.ts` |
| Route guards | `core/guards/guards.spec.ts` |
| HTTP interceptors | `core/interceptors/interceptors.spec.ts` (18 cases: token scope, 401 refresh, single refresh, no loop, error matrix, CORS-safe header) |
| Lifecycle / change detection | `shared/components/lifecycle-components.spec.ts` |
| Other | `connectivity.service.spec.ts` (BehaviorSubject), `token-storage.service.spec.ts`, `shared/utils/csv.spec.ts` |
| **E2E (Playwright)** — the 11 required workflows | `e2e/ems.spec.ts`: login, dashboard, create employee (FormArray), view details, edit, search+filter (URL state), apply leave, manager approves, attendance check-in, org chart, role guard + logout |
| E2E — modules | `e2e/modules.spec.ts`: all 16 screens render with **no console/runtime errors**, departments CRUD, designations dialog validation, holidays, reports + real CSV download, settings (template-driven), notifications, profile, users, change-password round-trip, promotion/transfer, client-side employee CSV export |

## 4. Relevant file paths
`src/**/*.spec.ts`, `src/testing/test-helpers.ts`, `e2e/*.ts`, `e2e/seed.mjs`, `karma.conf.js`, `playwright.config.ts`.

## 5. Practical implementation explanation — what the tests actually caught
| Layer | Finding |
|---|---|
| E2E | `POST /employees` with `workLocation: null` → **backend 500** (NOT NULL column) → client now omits blank `workLocation`; unit-tested |
| E2E | After editing, the details page showed **stale data** (route resolvers don't re-run on child navigation) → shared `EmployeeDetailsState` + `runGuardsAndResolvers:'always'` for departments |
| E2E/debug | Save button seemed dead: Angular applied the **async validator result without emitting `statusChanges`** → explicit `checkingEmail` signal + auto-resubmit |
| E2E | Re-running created **duplicate leave/holiday** (backend correctly rejects overlaps/dups) → tests use per-run dates |
| Unit | phone regex copied from the backend does **not** accept a leading `(` — test expectation corrected, behaviour matches the API |
| Unit | `TestBed.flushEffects()` does not run **component** effects — use `fixture.detectChanges()` (documented in the specs) |
| Unit | 5xx GETs are retried with back-off, so error-state tests use non-transient statuses |
| Review | a custom `X-Request-Id` header would fail the backend's CORS preflight on cross-origin deploys → gated to same-origin (unit-tested) |

**Isolation:** E2E uses the backend's own `*_test` database (never the dev DB); seed data via the public API (`e2e/seed.mjs`); credentials from environment variables only; each Playwright test gets a clean browser context (so browser-local data — education/experience — is asserted in the same test that creates it).

## 6. Why this concept was selected
The brief demands test coverage across components, services, Angular concepts and E2E; the interesting risks (token rotation, URL-driven state, async validation, role scoping) only show up when layers are combined, hence real-backend E2E.

## 7. Interview-related considerations
* *Testing pyramid:* many fast unit tests, fewer component tests, a handful of E2E journeys.
* *`HttpTestingController`:* `expectOne` then `flush`; call `verify()` in `afterEach` to catch unexpected requests.
* *`fakeAsync` + `tick`* to test `debounceTime`/`timer` deterministically; `discardPeriodicTasks()` for timers you don't finish.
* *Testing signals/effects:* read signals directly; flush effects via `TestBed.flushEffects()` (root) or change detection (component).
* *Don't mock what you own:* interceptors are tested through the real `HttpClient` chain, not by calling the function with fake `next`.
* *Flaky E2E:* use auto-waiting locators (`expect(locator)`), stable `data-testid`s, no sleeps.
