# EMS-Angular · Angular concept mapping

Every concept requested in the brief (§4.1 – §4.15) mapped to **where it is genuinely implemented**, with the file, the component/service/directive/pipe, and the test that exercises it.

* Paths are relative to `src/app/` unless they start with `e2e/` or `src/`.
* **✘ = not implemented** (with the reason). Nothing is listed as implemented that exists only in documentation.
* Unit tests are Jasmine/Karma (`*.spec.ts`); E2E tests are Playwright (`e2e/ems.spec.ts` = the 11 required workflows, `e2e/modules.spec.ts` = module journeys).
* Concept docs: `docs/angular-concepts/NN-*.md` (the number in the last column).

Legend for test column: **U** = unit/component spec, **E** = Playwright.

## 4.1 Components
| Concept | Actual implementation feature | File path | Component / symbol | Test | Doc |
|---|---|---|---|---|---|
| Standalone components | all UI | `**/*.component.ts` (72 components, 0 `@NgModule`) | – | build + all specs | 01 |
| Parent / child components, composition | employee details shell + tabs; org tree recursion | `features/employees/employee-details.component.ts`, `employee-tabs.component.ts`; `features/organization/org-node.component.ts` | `EmployeeDetailsComponent`, `EmployeeOverviewComponent`, `OrgNodeComponent` | U `organization.component.spec.ts`; E `ems.spec.ts` §4, §10 | 01, 03 |
| Lifecycle hooks | see 4.14 | – | – | – | 18 |
| Component communication / `input()` / `output()` | cards, tables, org nodes | `shared/components/employee-card.component.ts`, `data-table.component.ts`, `features/organization/org-node.component.ts` | `EmployeeCardComponent`, `DataTableComponent`, `OrgNodeComponent` | U `employee-list.component.spec.ts`, `organization.component.spec.ts` | 03 |
| Two-way binding | search box (`model`); settings form (`ngModel`) | `shared/components/search-box.component.ts`; `features/profile/settings.component.ts` | `SearchBoxComponent.value`, `SettingsComponent` | U `search-box.component.spec.ts`; E `modules.spec.ts` settings | 02 |
| Event / property / attribute / class / style binding | every template | e.g. `org-node.component.ts`, `profile-picture.component.ts`, `data-table.component.ts` | – | U component specs | 02 |
| Content projection (`ng-content`) | page header actions; dialog frame; badges; empty state | `shared/components/ui-basics.ts`, `dialogs.ts` | `PageHeaderComponent`, `DialogFrameComponent`, `EmptyStateComponent`, `StatusBadgeComponent` | E (every page) | 01, 13 |
| Dynamic components | role-based dashboard widgets | `features/dashboard/dashboard.component.ts`, `dashboard-widgets.ts` | `*ngComponentOutlet`, `WidgetSpec`, `EventsWidgetComponent`, `ApprovalsWidgetComponent`, `BalancesWidgetComponent` | U `dashboard.component.spec.ts` | 01, 13 |
| Reusable modal / dialog components | confirm, reason, frame, per-feature dialogs | `shared/components/dialogs.ts`; `features/employees/job-change-dialog.component.ts`; `features/designations/designations.component.ts`; `features/holidays/holiday-dialog.component.ts` | `ConfirmDialogComponent`, `ReasonDialogComponent`, `DialogService` | E `modules.spec.ts` (designation, holiday), `ems.spec.ts` §8 | 01 |
| Reusable table & pagination | all lists; non-table lists; client-side report table | `shared/components/data-table.component.ts`, `pagination.component.ts`, `client-table.component.ts` | `DataTableComponent`, `CellDirective`, `PaginationComponent`, `ClientTableComponent` | U `employee-list.component.spec.ts`, `attendance.component.spec.ts`; E `ems.spec.ts` §6 | 01, 03 |
| Reusable form controls | employee picker; search; file upload | `shared/components/employee-select.component.ts`, `search-box.component.ts`, `file-upload.component.ts` | `EmployeeSelectComponent`, `SearchBoxComponent`, `FileUploadComponent` | U `employee-select.component.spec.ts`, `search-box.component.spec.ts` | 01, 21 |
| Components for each named screen (Login … User management) | feature screens | `features/auth`, `dashboard`, `employees`, `departments`, `designations`, `attendance`, `leaves`, `organization`, `reports`, `notifications`, `users`, `profile` | see `docs/backend-api-integration.md` | E (all 24 tests) | 01 |

## 4.2 Services
| Concept | Feature | File path | Service | Test | Doc |
|---|---|---|---|---|---|
| Dedicated service per feature (all 11 named + more) | HTTP/state per area | `core/services/{auth,employee,department,designation,attendance,leave,organization,notification,dashboard,report,profile,holiday,picture,reference-data,employee-extras,preferences,connectivity}.service.ts` | `AuthService`, `EmployeeService`, … | U `auth/employee/department/attendance/leave/organization/notification/dashboard/reference-data/picture/connectivity.service.spec.ts` | 04 |
| HTTP communication through one typed gateway | URL/envelope/timeout/retry | `core/services/api.service.ts` | `ApiService` | U every service spec | 04, 17 |
| Authentication management | login/refresh/logout/restore | `core/services/auth.service.ts` | `AuthService` | U `auth.service.spec.ts`; E `ems.spec.ts` §1, §11 | 04, 17 |
| Shared logic / state management | loading, toasts, permissions, breadcrumbs, preferences | `core/services/{loading,toast,permission,breadcrumb,preferences}.service.ts` | `LoadingService`, `PermissionService`, … | U `preferences-permission.spec.ts`; interceptors spec | 04, 06 |
| Components stay presentational; no catch-all service | – | feature components | – | – | 24 |

## 4.3 Dependency injection
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| `providedIn: 'root'` | every service | `core/services/*` | `@Injectable({ providedIn: 'root' })` | all U | 04 |
| Component-level providers | employee list state | `features/employees/employee-list.component.ts` | `providers: [EmployeeListStore]` | U `employee-list.store.spec.ts`, `employee-list.component.spec.ts` | 04 |
| Route-level providers | per-employee details state | `features/employees/employees.routes.ts` | `providers: [EmployeeDetailsState]` | E `ems.spec.ts` §4, §5 | 04 |
| Constructor injection | refresh-token storage | `core/services/token-storage.service.ts` | `constructor(@Inject(SESSION_STORAGE) …)` | U `token-storage.service.spec.ts` | 04 |
| `inject()` function | everywhere (guards, interceptors, resolvers, components) | e.g. `core/guards/guards.ts` | `inject(AuthService)` | U `guards.spec.ts` | 04 |
| Injection tokens (API base URL, config) | URL/config/storage | `core/tokens/tokens.ts` | `API_BASE_URL`, `APP_CONFIG`, `BROWSER_STORAGE`, `SESSION_STORAGE` | U `interceptors.spec.ts` (overrides `API_BASE_URL`), `test-helpers.ts` | 04 |
| Environment-based configuration | dev vs prod | `src/environments/environment*.ts`, `angular.json` `fileReplacements` | `environment` | build (dev + prod) | 04 |
| Hierarchical DI / provider scopes / optional injection | form works with and without details state | `features/employees/employee-form.component.ts` | `inject(EmployeeDetailsState, { optional: true })` | U `employee-form.component.spec.ts`; E `ems.spec.ts` §3 vs §5 | 04 |
| Custom service abstractions | token storage, picture cache, toast | `core/services/{token-storage,picture,toast}.service.ts` | – | U `token-storage.service.spec.ts`, `picture.service.spec.ts` | 04 |
| Replacing framework services | error handler, title, preloading | `core/errors/global-error-handler.ts`, `core/title-strategy.ts`, `core/preloading.ts`, wired in `app.config.ts` | `GlobalErrorHandler`, `AppTitleStrategy`, `SelectivePreloadingStrategy` | E (no runtime errors on 16 screens) | 04, 22 |

## 4.4 RxJS
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| Observable / Observer / Subscription | every request; `subscribe({next,error})` | `features/employees/employee-form.component.ts`, `features/auth/login.component.ts` | observer objects | U `employee-form.component.spec.ts` | 05 |
| Subject | login submit; refresh trigger; reload trigger; destroy | `features/auth/login.component.ts`, `core/services/notification.service.ts`, `layout/notification-menu.component.ts`, `shared/components/live-clock.component.ts` | `submit$`, `refresh$`, `reload$`, `destroy$` | U `login.component.spec.ts`, `notification.service.spec.ts`, `lifecycle-components.spec.ts` | 05 |
| BehaviorSubject | online/offline state | `core/services/connectivity.service.ts` | `state$` | U `connectivity.service.spec.ts` | 05 |
| ReplaySubject | recent auth events | `core/services/auth.service.ts` | `eventsSubject` (`events$`) | U `auth.service.spec.ts` | 05 |
| AsyncSubject | session-restore completion | `core/services/auth.service.ts`, `core/guards/guards.ts` | `sessionReady$` | U `auth.service.spec.ts`, `guards.spec.ts` | 05, 12 |
| Operators / pipe / map / filter / tap | everywhere | `core/services/api.service.ts` | – | all U | 05 |
| switchMap | search & reloads | `features/employees/employee-list.store.ts`, `shared/components/employee-select.component.ts` | `state`, search stream | U `employee-list.store.spec.ts`, `employee-select.component.spec.ts` | 05 |
| mergeMap | employee CSV export (3 parallel pages) | `features/employees/employee-list.component.ts` | `exportCsv()` | E `modules.spec.ts` (CSV export) | 05 |
| concatMap | create → picture → extras; apply → upload | `features/employees/employee-form.component.ts`, `features/leaves/leave-apply.component.ts` | `afterSave`, `submit` | U `leave-apply.component.spec.ts`, `employee-form.component.spec.ts`; E `ems.spec.ts` §3 | 05 |
| exhaustMap | prevent duplicate login | `features/auth/login.component.ts` | `submit$` pipeline | U `login.component.spec.ts` | 05 |
| debounceTime / distinctUntilChanged | search/autocomplete/filters | `shared/components/search-box.component.ts`, `employee-select.component.ts`, `features/organization/organization.component.ts` | – | U `search-box.component.spec.ts` | 05 |
| combineLatest | avatar from id + flag + cache version | `shared/components/profile-picture.component.ts` | `src` | E (avatars on lists) | 05 |
| forkJoin | dashboard; org detail | `core/services/dashboard.service.ts`, `features/organization/organization.component.ts` | `load()`, `detail` | U `dashboard.service.spec.ts`, `organization.component.spec.ts` | 05 |
| zip | balances + leave-type metadata | `features/leaves/leave-home.component.ts` | `balances` | E `ems.spec.ts` §8 (leave page) | 05 |
| merge | notification poll + manual refresh; online/offline events | `core/services/notification.service.ts`, `connectivity.service.ts` | – | U `notification.service.spec.ts`, `connectivity.service.spec.ts` | 05 |
| startWith | loading state | `employee-list.store.ts`, list components | – | U `employee-list.store.spec.ts` | 05 |
| catchError | state instead of exceptions | `employee-list.store.ts`, `dashboard.service.ts` | – | U `dashboard.service.spec.ts`, store spec | 05 |
| retry (modern `retryWhen`) | transient GET failures | `core/services/api.service.ts` | `retry({ count, delay })` | U (interceptor/organization specs — no retry on search) | 05, 17 |
| shareReplay | reference data; token refresh; blob cache | `reference-data.service.ts`, `auth.service.ts`, `picture.service.ts` | – | U `reference-data.service.spec.ts`, `auth.service.spec.ts`, `picture.service.spec.ts` | 05 |
| take / takeUntil / takeUntilDestroyed | settle wait; clock; component subs | `employee-form.component.ts`, `live-clock.component.ts`, `search-box.component.ts` | – | U `lifecycle-components.spec.ts` | 05, 18 |
| of / from / throwError | fallbacks; sequential steps; error propagation | `employee-form.component.ts`, `interceptors.ts` | – | U `interceptors.spec.ts` | 05 |
| iif | manager-only requests | `core/services/dashboard.service.ts` | `load()` | U `dashboard.service.spec.ts` | 05 |
| timeout | every API call | `core/services/api.service.ts` | – | – (config-driven; not separately asserted) | 05 |
| firstValueFrom / lastValueFrom | guards; export | `core/guards/guards.ts`, `employee-list.component.ts` | – | U `guards.spec.ts`; E CSV export | 05 |
| Higher-order observables, cancellation, error handling, subscription management | see rows above | – | – | U `employee-list.store.spec.ts` (cancelled request) | 05 |
| RetryWhen | **✘** deprecated — replaced by `retry({ delay })` | – | – | – | 05 |

Practical examples from the brief: search with debounce+switchMap ✔ (`search-box` + store) · dashboard `forkJoin` ✔ · employee+department `combineLatest` ✔ in spirit (avatar/filters; the employee list reads department names from the API payload instead of joining client-side — the backend already returns them) · dependent calls `switchMap` ✔ (resolver/detail loads) · sequential `concatMap` ✔ · login `exhaustMap` ✔ · reference data `shareReplay` ✔ · notification streams ✔ · no leaks ✔.

## 4.5 Signals
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| `signal()` / `computed()` | auth, UI flags, dashboard stats | `core/services/auth.service.ts`, `features/dashboard/dashboard.component.ts` | `_user`, `isAuthenticated`, `stats` | U `auth.service.spec.ts`, `dashboard.component.spec.ts` | 06 |
| `effect()` | persist prefs; drawer; scroll | `core/services/preferences.service.ts`, `layout/shell.component.ts`, `organization.component.ts` | – | U `preferences-permission.spec.ts` | 06 |
| `linkedSignal()` | page reset; selection retention | `features/employees/employee-list.store.ts` | `page`, `selectedId` | U `employee-list.store.spec.ts` | 06 |
| `input()` / `output()` / `model()` | component APIs | `shared/components/*` | `SearchBoxComponent.value` (model) | U `search-box.component.spec.ts` | 03, 06 |
| `asReadonly()` | expose state read-only | `auth.service.ts`, `preferences.service.ts`, `breadcrumb.service.ts` | – | U | 06 |
| `toSignal()` / `toObservable()` | RxJS ↔ signals | `employee-list.store.ts`, `profile-picture.component.ts`, `notification.service.ts` | – | U `notification.service.spec.ts` | 06 |
| `untracked()` | effects reading without dependency | `preferences.service.ts`, `organization.component.ts` | – | – | 06 |
| Signal state shared via services | auth, notifications, loading | `core/services/*` | – | U | 06 |
| Auth state / logged-in user / filters / selected employee / dashboard stats / notification count / loading+error / leave balance summaries / org selection | each as signal/computed | `auth.service.ts`, `employee-list.store.ts`, `dashboard.component.ts`, `notification.service.ts`, `loading.service.ts`, `leave-home.component.ts`, `organization.component.ts` | – | U + E | 06 |

## 4.6 Reactive Forms
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| FormGroup / FormControl / nested groups | employee, profile | `features/employees/employee-form.component.ts` | `form`, `address`, `emergency`, `account` | U `employee-form.component.spec.ts` | 07 |
| FormBuilder | department, designation, leave type, … | `features/departments/department-form.component.ts`, `designations.component.ts`, `leave-admin.component.ts` | `FormBuilder` | U `department-form.component.spec.ts` | 07 |
| NonNullableFormBuilder (typed forms) | employee, leave, login, passwords | `employee-form.component.ts`, `leave-apply.component.ts`, `login.component.ts` | `NonNullableFormBuilder` | U specs | 07 |
| FormArray | education, experience, skills | `employee-form.factory.ts`, `employee-form.component.html` | `education`, `experience`, `skills` | U `employee-form.factory.spec.ts`, `employee-form.component.spec.ts`; E `ems.spec.ts` §3 | 07, 09 |
| Built-in validators | everywhere | – | `Validators.*` | U | 07 |
| Custom sync validators | password, phone, dates | `shared/validators/validators.ts` | `passwordComplexity`, `phoneNumber`, `pastDate`, `futureOrToday` | U `validators.spec.ts` | 07 |
| Custom async validator | duplicate work e-mail | `shared/validators/validators.ts`, `core/services/employee.service.ts` | `uniqueValue`, `emailExists` | U `validators.spec.ts`, `employee.service.spec.ts`, `employee-form.component.spec.ts`; E `ems.spec.ts` §3b | 07 |
| Cross-field / form-level validation | confirm password; date ranges; probation; half-day | `validators.ts`, `employee-form.component.ts`, `leave-apply.component.ts` | `matchFields`, `dateRange`, `numberRange`, `probationAfterJoining`, `halfDayRule` | U `validators.spec.ts`, `leave-apply.component.spec.ts` | 07 |
| Conditional validators | account password; experience end date | `validators.ts` (`validateIf`), `employee-form.factory.ts` | `validateIf` | U `employee-form.factory.spec.ts` | 07 |
| Dynamic controls / dynamic FormArray | rows added/removed at runtime | `employee-form.component.ts` | `addEducation`, `remove` | U + E | 07, 09 |
| Enable / disable controls | account section; current job; employee code | `employee-form.component.ts`, `employee-form.factory.ts` | `enable()/disable()` | U `employee-form.component.spec.ts` | 07 |
| setValue / patchValue / reset / getRawValue | department upper-casing; edit prefill; reset | `department-form.component.ts`, `employee-form.component.ts` | – | U `department-form.component.spec.ts` | 07 |
| valueChanges | debounced filters/search | `search-box.component.ts`, `attendance.component.ts`, `report-panel.component.ts` | – | U `search-box.component.spec.ts` | 07 |
| statusChanges | report export enablement | `features/reports/report-panel.component.ts` | `formValid` | E `modules.spec.ts` reports | 07, 19 |
| dirty/pristine, touched/untouched, pending, invalid | guard, errors, e-mail check | `employee-form.component.ts`, `guards.ts` | `hasUnsavedChanges`, `checkingEmail` | U `employee-form.component.spec.ts`, `guards.spec.ts`, `validators.spec.ts` (pending) | 07 |
| Submission handling + server errors; dynamic messages | – | `employee-form.component.ts`, `shared/validators/validators.ts` | `applyServerErrors`, `errorMessage` | U `employee-form.component.spec.ts`, `department-form.component.spec.ts`, `validators.spec.ts` | 07 |

## 4.7 Template-driven forms
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| FormsModule, `ngForm`, `ngModel`, `ngModelGroup`, `ngModelOptions`, `ngSubmit`, built-in validators, custom validation, template reference variables, state/messages | **Settings** page | `features/profile/settings.component.ts` | `SettingsComponent`, `NotOnlyDigitsDirective` | E `modules.spec.ts` “settings: template-driven form…” | 08 |

## 4.8 Routing
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| Basic / default / redirect / wildcard | shell routes | `app.routes.ts` | `routes` | E `ems.spec.ts` §11, `modules.spec.ts` (404 page) | 10 |
| Route params / query params | `:id`; list filters | `features/*/*.routes.ts`, `employee-list.component.ts` | – | E `ems.spec.ts` §6 | 10, 11 |
| Child & nested routes | details → tabs | `features/employees/employees.routes.ts` | – | E `ems.spec.ts` §4 | 10 |
| Lazy loading: `loadComponent` / `loadChildren` | all features | `app.routes.ts` | – | production build chunks | 10, 22 |
| Route data | breadcrumbs, permissions, preload | `app.routes.ts` | `data` | U `guards.spec.ts` | 10 |
| Resolvers | employee, department | `core/resolvers/resolvers.ts` | `employeeResolver`, `departmentResolver` | E `ems.spec.ts` §4/§5 | 10, 12 |
| Guards | see 4.10 | – | – | – | 12 |
| Programmatic navigation | after saves/login | many | `Router.navigate` | U (`navigate` spies) | 11 |
| Router events | breadcrumbs | `core/services/breadcrumb.service.ts` | `NavigationEnd` | E (breadcrumb text visible) | 11 |
| Custom `UrlMatcher` | organization selection | `features/organization/organization.routes.ts` | `organizationMatcher` | U `organization.component.spec.ts` | 10 |
| Preloading strategy | selective | `core/preloading.ts` | `SelectivePreloadingStrategy` | build | 22 |
| Route reuse concepts | component instance reused across `/organization(/:id)` | `organization.routes.ts` | matcher | U `organization.component.spec.ts` | 10 |
| Custom `RouteReuseStrategy` | **✘** not needed; not implemented | – | – | – | 10 |

## 4.9 ActivatedRoute and Router
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| Route params | resolver reads `:id` | `core/resolvers/resolvers.ts` | `route.paramMap` | E | 11 |
| Query params (+ observables) | list filters; calendar view | `employee-list.component.ts`, `calendar-page.component.ts` | `route.queryParamMap` | E `ems.spec.ts` §6 | 11 |
| Route snapshots | returnUrl; reset token | `login.component.ts`, `reset-password.component.ts` | `route.snapshot` | U `login.component.spec.ts` | 11 |
| Parameter observables | org selection | `organization.component.ts` | `route.paramMap` | U `organization.component.spec.ts` | 11 |
| Route data | tabs/profile read resolved employee | `employee-details.component.ts`, `employee-profile.component.ts` | `route.data` | E | 11 |
| Parent / child route access | history tab reads grand-parent `:id` | `features/employees/employee-tabs.component.ts` | `route.parent?.parent` | E `ems.spec.ts` §4 | 11 |
| Navigation state | “Back to filtered list” | `employee-list.component.ts` → `employee-details.component.ts` | `state: { from }`, `getCurrentNavigation()` | E | 11 |
| Open profile from list; navigate details ↔ edit ↔ history | – | `employee-list.component.ts`, `employee-details.component.ts` | – | E `ems.spec.ts` §4–§5 | 11 |

## 4.10 Route guards
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| Authentication guard | shell | `core/guards/guards.ts` | `authGuard` | U `guards.spec.ts`; E §11 | 12 |
| Guest-only guard | login screens | `guards.ts` | `guestGuard` | U | 12 |
| Role guard | `data.roles` | `guards.ts` | `roleGuard` | U (no route currently sets `roles`) | 12 |
| Permission guard | `data.permissions` | `guards.ts` | `permissionGuard` | U; E §11 | 12 |
| `CanActivateChildFn` | whole shell subtree | `guards.ts` | `childAccessGuard` | U | 12 |
| `CanDeactivateFn` (unsaved forms) | forms | `guards.ts` | `unsavedChangesGuard`, `HasUnsavedChanges` | U `guards.spec.ts`, form specs | 12 |
| `ResolveFn` | employee, department | `resolvers.ts` | – | E | 12 |

## 4.11 Directives
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| `@if` / `@for` / `@switch` (modern) | all templates; calendar switch | `**/*.component.ts`, `holidays/calendar-page.component.ts` | – | U + E | 13 |
| `*ngIf` / `*ngFor` / `*ngSwitch` (legacy, with modern equivalents documented) | password checklist | `shared/components/password-strength.component.ts` | `PasswordStrengthComponent` | U `lifecycle-components.spec.ts` | 13 |
| `ngClass` / `ngStyle` | unread rows; strength bar | `notifications.component.ts`, `password-strength.component.ts` | – | U | 13 |
| `ngTemplateOutlet` | table cells; calendar days | `data-table.component.ts`, `month-calendar.component.ts` | – | U `employee-list.component.spec.ts` | 13 |
| `ngComponentOutlet` | dashboard widgets | `dashboard.component.ts` | – | U `dashboard.component.spec.ts` | 13 |
| `ng-container` / `ng-template` / `ng-content` | everywhere | – | – | – | 13 |
| `appHasRole` | login-role block (HR/super-admin) | `shared/directives/directives.ts`; `employee-tabs.component.ts` | `HasRoleDirective` | U `directives.spec.ts` | 14 |
| `appHasPermission` | gated actions | `directives.ts` | `HasPermissionDirective` | U `directives.spec.ts` | 14 |
| `appAutofocus` | first field of forms/dialogs | `directives.ts` | `AutofocusDirective` | U | 14 |
| `appHighlight` | employee cards | `directives.ts`, `employee-card.component.ts` | `HighlightDirective` | U | 14 |
| `appNumbersOnly` | leave-admin year | `directives.ts`, `leave-admin.component.ts` | `NumbersOnlyDirective` | U | 14 |
| Custom structural directive | role/permission rendering | `directives.ts` | `HasRoleDirective`, `HasPermissionDirective` | U | 14 |

## 4.12 Pipes
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| Date / Currency / Decimal / Percent / UpperCase / LowerCase / TitleCase / Json / KeyValue / Slice / Async / I18nSelect | see doc 15 for the exact screen of each | `employee-tabs.component.ts`, `leave-home.component.ts`, `dashboard-widgets.ts`, `attendance.component.ts`, `reports.component.ts`, `leave-apply.component.ts` | – | E (screens render) | 15 |
| Employee status / employment type / leave status / employee name / working hours / date-time | list, details, attendance, leave | `shared/pipes/pipes.ts` | `EmployeeStatusPipe`, `EmploymentTypePipe`, `LeaveStatusPipe`, `EmployeeNamePipe`, `WorkingHoursPipe`, `ServerDateTimePipe` | U `pipes.spec.ts` | 16 |

## 4.13 HTTP interceptors
| Concept | Feature | File | Symbol | Test | Doc |
|---|---|---|---|---|---|
| Auth token interceptor | Bearer for API only | `core/interceptors/interceptors.ts` | `authInterceptor` | U `interceptors.spec.ts` | 17 |
| Refresh-token handling; single refresh; no loop; failure → logout | – | `interceptors.ts`, `auth.service.ts` | `refreshInterceptor`, `refreshAccessToken` | U `interceptors.spec.ts`, `auth.service.spec.ts` | 17 |
| Global error handling; 401/403/404/409/422/500; no duplicate toasts | – | `interceptors.ts`, `core/errors/app-error.ts`, `toast.service.ts` | `errorInterceptor`, `toAppError` | U `interceptors.spec.ts` | 17 |
| Loading indicator (+ opt-out) | shell progress bar | `interceptors.ts`, `loading.service.ts`, `http-context.ts` | `loadingInterceptor`, `SKIP_LOADING` | U `interceptors.spec.ts` | 17 |
| Correlation id | same-origin only | `interceptors.ts` | `correlationIdInterceptor` | U `interceptors.spec.ts` | 17 |
| `provideHttpClient(withInterceptors([...]))` | – | `app.config.ts` | – | all U/E | 17 |

## 4.14 Lifecycle hooks
| Hook | Implemented in | Test | Doc |
|---|---|---|---|
| `ngOnInit` | `shared/components/live-clock.component.ts` | U `lifecycle-components.spec.ts` | 18 |
| `ngOnChanges` | `shared/components/password-strength.component.ts` | U `lifecycle-components.spec.ts` | 18 |
| `ngOnDestroy` | `live-clock.component.ts`, `core/services/picture.service.ts` | U `lifecycle-components.spec.ts`, `picture.service.spec.ts` | 18 |
| `ngAfterViewInit` | `features/organization/organization.component.ts` | E `ems.spec.ts` §10 | 18 |
| `ngAfterContentInit` | `shared/components/data-table.component.ts` | U `employee-list.component.spec.ts` | 18 |
| `ngAfterViewChecked` | **✘** no genuine use case (runs every CD pass) | – | 18 |
| `ngAfterContentChecked` | **✘** no genuine use case | – | 18 |
| `DestroyRef` / `takeUntilDestroyed()` | `search-box`, `employee-list`, `employee-details`, `employee-profile`, `employee-form`, `login` | U `search-box.component.spec.ts` | 18 |

## 4.15 Additional concepts
| Concept | Implementation | File | Test | Doc |
|---|---|---|---|---|
| Content projection | see 4.1 | `shared/components/*` | E | 01 |
| `ViewChild` / `ViewChildren` | file input reset; sidenav; focus first invalid input | `file-upload.component.ts`, `shell.component.ts`, `employee-form.component.ts` | E (`ems.spec.ts` §3b) | 20 |
| `ContentChild` / `ContentChildren` | calendar day template; table cell templates | `month-calendar.component.ts`, `data-table.component.ts` | U `employee-list.component.spec.ts` | 20 |
| Template reference variables | file input; settings form; autocomplete | `file-upload.component.ts`, `settings.component.ts`, `employee-select.component.ts` | E | 08, 20 |
| `ViewEncapsulation` | `None` on the badge component (global palette); default elsewhere | `shared/components/ui-basics.ts` | E | 19 |
| `ChangeDetectionStrategy.OnPush` | 70 of 72 components | all | E | 19 |
| `ChangeDetectorRef` | clock ticks | `live-clock.component.ts` | U | 19 |
| `track` in `@for` / `trackBy` | all lists; checklist | templates, `password-strength.component.ts` | U `lifecycle-components.spec.ts` | 13, 19 |
| **ControlValueAccessor** | employee selector | `shared/components/employee-select.component.ts` | U `employee-select.component.spec.ts` | 21 |
| Custom validators | see 4.6 | `shared/validators/validators.ts` | U | 07 |
| InjectionToken | see 4.3 | `core/tokens/tokens.ts` | U | 04 |
| Environment configuration | – | `src/environments/*` | build | 04 |
| Lazy loading / preloading strategies | – | `app.routes.ts`, `core/preloading.ts` | build | 22 |
| `ErrorHandler` / global error handling | – | `core/errors/global-error-handler.ts` | E (no console errors) | 04, 17 |
| Angular Material dialogs and snack bars | confirm/reason/feature dialogs; toasts | `shared/components/dialogs.ts`, `core/services/toast.service.ts` | U `interceptors.spec.ts` (toast), E | 01, 17 |
| Dynamic component loading | dashboard widgets | `dashboard.component.ts` | U | 01, 13 |
| Route resolvers | see 4.10 | `core/resolvers/resolvers.ts` | E | 12 |
| Signal/RxJS interoperability | `toSignal`/`toObservable` | many | U `employee-list.store.spec.ts` | 06 |
| Typed forms | see 4.6 | forms | U | 07 |
| Internationalization readiness | **partial**: `i18n` attributes on the login screen + `@angular/localize` set up; locale-aware pipes; no translation files/locale switcher | `features/auth/login.component.ts`, `angular.json`, `tsconfig.*` | U `login.component.spec.ts` (renders with localize) | 24 |
| NgModule concepts | Angular Material NgModules imported by standalone components (`MatButtonModule`, …); no custom NgModule | all components | build | 01 |
