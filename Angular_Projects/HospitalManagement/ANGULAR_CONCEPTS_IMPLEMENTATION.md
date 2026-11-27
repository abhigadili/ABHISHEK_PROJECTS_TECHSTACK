# Angular Concepts – Implementation Map

Every concept below is implemented in a real healthcare scenario; the table gives the **exact file(s)** (relative to the project root). All paths in this document were machine-checked against the file system. Signals, NgRx and RxJS have their own detailed documents: [SIGNALS_IMPLEMENTATION.md](SIGNALS_IMPLEMENTATION.md), [NGRX_IMPLEMENTATION.md](NGRX_IMPLEMENTATION.md), [RXJS_IMPLEMENTATION.md](RXJS_IMPLEMENTATION.md). Business scenarios: [BUSINESS_FLOWS.md](BUSINESS_FLOWS.md).

## 1. Architecture, bootstrap, modules
| Concept | Implementation |
|---|---|
| Application bootstrap (`bootstrapApplication`) | `src/main.ts`, `src/app/app.config.ts` |
| Root component | `src/app/app.component.ts` |
| Standalone components (default everywhere) | every `*.component.ts` under `src/app/features`, `src/app/shared`, `src/app/layouts` |
| **NgModule** (isolated feature) | `src/app/features/admin/admin.module.ts` – declares `AdminUsersComponent` + `AdminUserFormComponent` (`standalone: false`), imports `CommonModule`, `ReactiveFormsModule`, `RouterModule.forChild` |
| Lazy-loading an NgModule | `src/app/app.routes.ts` (`path: 'admin'` → `loadChildren(...AdminModule)`) |
| Zoneless application | `src/app/app.config.ts` (`provideExperimentalZonelessChangeDetection`), flag in `src/environments/environment.ts` |
| Environment configuration | `src/environments/environment.ts`, `src/environments/environment.prod.ts`, `proxy.conf.json` |

## 2. Components and templates
| Concept | Implementation |
|---|---|
| Component metadata (`selector`, `imports`, `providers`, `changeDetection`, `template`, `styles`) | any component, e.g. `src/app/features/hospitals/hospital-card.component.ts` (also `viewProviders`) |
| Selectors (element, attribute) | element: `src/app/shared/components/page-header.component.ts`; attribute: `src/app/shared/directives/directives.ts` |
| Interpolation, template expressions, pipes in templates | `src/app/features/doctors/doctor-list.component.ts`, `src/app/features/prescriptions/prescription-view.component.ts` |
| Property binding / attribute binding (`[attr.aria-*]`) | `src/app/features/billing/billing-generate.component.ts`, `src/app/features/doctors/doctor-tabs.component.ts` |
| Class binding `[class.x]` / style binding `[style.x]` | `src/app/features/appointments/appointment-list.component.ts`, `src/app/features/patients/patient-list.component.ts` |
| Event binding | `src/app/features/pharmacy/pharmacy-medicines.component.ts` |
| Two-way binding (`[(x)]`, `model()`, `ngModel`) | `src/app/features/prescriptions/prescription-generate.component.ts` (`[(patient)]`), `src/app/features/notifications/notification-send.component.ts` (`[(ngModel)]`) |
| Template reference variables | `src/app/features/notifications/notification-send.component.ts` (`#f="ngForm"`, `#em="ngModel"`) |
| Control flow `@if / @else / @for (track) / @switch / @empty` | `src/app/features/laboratory/lab-request-details.component.ts` (`@switch`), `src/app/features/dashboard/dashboard.component.ts` (`@for … @empty`) |
| `@let` declarations | `src/app/features/prescriptions/prescription-view.component.ts`, `src/app/features/laboratory/lab-request-new.component.ts` |
| `@defer` (lazy template blocks) | `src/app/features/dashboard/dashboard.component.ts`, `src/app/features/medical-records/patient-record.component.ts` |
| Content projection (single, multi-slot `select`, `ng-content`) | `src/app/shared/components/card.component.ts`, `src/app/shared/components/page-header.component.ts`, `src/app/features/prescriptions/prescription-view.component.ts` |
| `ng-container`, `ng-template`, template context | `src/app/shared/components/state-views.component.ts` (`DataStateComponent` projects a `#loaded` template with `$implicit` context) |
| `ngTemplateOutlet` / `ngComponentOutlet` / legacy `*ngIf *ngFor [ngSwitch] [ngClass] [ngStyle]` | `src/app/features/hospitals/legacy-facility-panel.component.ts` (deliberately isolated) |
| View encapsulation (`Emulated` default, `None`) | `src/app/features/hospitals/legacy-facility-panel.component.ts` (`ViewEncapsulation.None`) |
| Generic component | `src/app/shared/components/state-views.component.ts` (`DataStateComponent<T>`) |
| Standalone dialogs | `src/app/shared/components/confirm-dialog.component.ts`, `src/app/features/doctors/doctor-compare-dialog.component.ts` |

## 3. Component communication
| Concept | Implementation |
|---|---|
| `input()` / `input.required()` | `src/app/shared/components/pager.component.ts`, `src/app/features/prescriptions/prescription-details.component.ts` |
| `output()` / `outputFromObservable()` | `src/app/shared/components/pager.component.ts`, `src/app/shared/components/search-box.component.ts` |
| `model()` two-way component API | `src/app/shared/components/patient-picker.component.ts`, `src/app/features/patients/patient-form.component.ts` |
| Legacy `@Input()` / `@Output() EventEmitter` | `src/app/features/patients/patient-form.component.ts`, `src/app/features/admin/admin-user-form.component.ts` |
| `viewChild` / `viewChildren` | `src/app/features/patients/patient-form.component.ts`, `src/app/shared/components/file-dropzone.component.ts` |
| `contentChild` / `contentChildren` | `src/app/shared/components/tabs.component.ts`, `src/app/shared/components/card.component.ts` |
| Parent ↔ child via service | `src/app/features/patients/patient-context.service.ts`, `src/app/features/doctors/doctor-context.ts` |
| Event bus (Subject / BehaviorSubject / ReplaySubject / AsyncSubject) | `src/app/core/services/event-bus.service.ts` |
| Service → component (signals / observables) | `src/app/core/services/notification-center.service.ts`, `src/app/core/services/loading.service.ts` |
| Route data → component inputs | `src/app/features/laboratory/lab-requests.component.ts` (`view` input from `data`), `src/app/features/notifications/notification-list.component.ts` (`unread`) |

## 4. Lifecycle hooks
`ngOnChanges`, `ngOnInit`, `ngDoCheck`, `ngAfterContentInit`, `ngAfterContentChecked`, `ngAfterViewInit`, `ngAfterViewChecked`, `ngOnDestroy` are implemented – with a visible per-hook counter – by `src/app/features/appointments/appointment-summary.component.ts`, logged by `src/app/features/appointments/lifecycle-log.service.ts` and displayed in `src/app/features/appointments/appointment-details.component.ts`. Further: `ngOnDestroy` cleanup in `src/app/features/admin/admin-users.component.ts`; `afterNextRender` in `src/app/shared/directives/directives.ts`; modal lifecycle in `src/app/shared/components/confirm-dialog.component.ts`.

## 5. Directives
| Concept | Implementation |
|---|---|
| Attribute directive with `ElementRef`, `Renderer2`, `@HostListener`/`host` | `src/app/shared/directives/directives.ts` – `appHighlight`, `appFocus`, `appClickOutside`, `appTooltip` |
| Structural directives with `TemplateRef` + `ViewContainerRef` | `src/app/shared/directives/directives.ts` – `*appHasPermission`, `*appRole` |
| Directive composition (`hostDirectives`) | `src/app/shared/directives/directives.ts` – `appInteractive` |
| Validator directives (template-driven forms) | `src/app/shared/validators/template-validators.ts` – `appPhone`, `appForbidden` (`NG_VALIDATORS` multi provider) |
| Built-in directives | `ngClass`, `ngStyle`, `ngModel`, `routerLink`, `routerLinkActive` across features |

## 6. Pipes
`src/app/shared/pipes/pipes.ts`: pure `patientName`, `specialization`, `appointmentStatus`, `recordDate`, `billingAmount`, `medicineInfo`; **impure** `relativeTime` (re-evaluated every change-detection pass → used in `src/app/features/notifications/notification-list.component.ts`) and `filterBy`. Built-in pipes (`date`, `currency`, `titlecase`, `number`, `async`-free signal reads) throughout, e.g. `src/app/features/billing/billing-details.component.ts`. Pipes injected programmatically: `src/app/features/doctors/doctor-compare-dialog.component.ts` (`CurrencyPipe` as a class).

## 7. Dependency injection
| Concept | Implementation |
|---|---|
| `inject()` (everywhere) and constructor injection (classic) | `src/app/core/api/base-api.service.ts`; classic: `src/app/features/admin/admin-users.component.ts` |
| `InjectionToken` (config, page size, logger…) | `src/app/core/configuration/app-config.ts` (`APP_CONFIG`, `API_PREFIX`, `DEFAULT_PAGE_SIZE`, `LOGGER`, `NAV_ITEMS`), `src/app/features/hospitals/hospital-context.service.ts` (`HOSPITAL_PAGE_SIZE`, `CARD_DENSITY`) |
| `useClass` | `src/app/core/configuration/app-config.ts` (`ConsoleLogger` ↔ `QuietLogger`), `src/app/app.config.ts` (`ErrorHandler`) |
| `useValue` | `src/app/features/patients/patients.routes.ts`, `src/app/layouts/nav-items.ts` |
| `useFactory` | `src/app/features/hospitals/hospitals.routes.ts` (factory reading `APP_CONFIG`) |
| `useExisting` + `forwardRef` | `src/app/core/configuration/app-config.ts` (`notificationChannelProvider`) |
| Multi providers | `src/app/layouts/nav-items.ts` (`NAV_PROVIDERS`), `src/app/shared/validators/template-validators.ts`, `HTTP_INTERCEPTORS` in `src/app/app.config.ts` |
| `providedIn: 'root'` / `'platform'` | root: `src/app/core/services/theme.service.ts`; platform: `src/app/core/configuration/app-config.ts` (`PlatformInfoService`) |
| Component-level providers / `viewProviders` | `src/app/features/hospitals/hospital-card.component.ts`, `src/app/features/laboratory/lab-request-new.component.ts` (`providers: [LabRequestStore]`) |
| Route-level providers | `src/app/features/patients/patients.routes.ts`, `src/app/features/doctors/doctors.routes.ts`, `src/app/features/billing/billing.routes.ts` |
| Environment providers / initialisers | `src/app/app.config.ts` (`provideAppInitializer`), `src/app/features/hospitals/hospitals.routes.ts` (`provideEnvironmentInitializer`) |
| `@Self`/`self`, `@SkipSelf`/`skipSelf`, `@Host`/`host`, `@Optional`/`optional` | `src/app/features/hospitals/hospital-card.component.ts`, `src/app/features/hospitals/hospital-context.service.ts`, `src/app/features/patients/patient-context.service.ts` |
| Hierarchical / element vs. environment injector | `src/app/features/hospitals/hospital-card.component.ts` (element injector chain: card → list), `src/app/app.config.ts` (environment injector) |
| `EnvironmentInjector` + `runInInjectionContext` | `src/app/features/appointments/appointment-feed.facade.ts` |
| Tree-shakable singleton, feature-level services | `src/app/features/prescriptions/prescription.service.ts`, `src/app/features/dashboard/dashboard.service.ts` |

## 8. Services (patterns)
API services `src/app/core/api/*.ts` (abstract `BaseApiService`, generic `CrudApiService`); authentication `src/app/core/auth/auth.service.ts`; authorization `src/app/core/auth/permissions.ts` + `src/app/core/guards/auth.guards.ts`; notification `src/app/core/services/notification.service.ts`, `src/app/core/services/notification-center.service.ts`; logging `src/app/core/services/logging.service.ts`; configuration `src/app/core/configuration/app-config.ts`; file `src/app/core/services/file.service.ts`; validation `src/app/shared/validators/validators.ts`; utility `src/app/shared/utilities/helpers.ts`; communication `src/app/core/services/event-bus.service.ts`; error handling `src/app/core/services/app-error-handler.ts`; theme `src/app/core/services/theme.service.ts`; session `src/app/core/services/session-manager.service.ts`.

## 9. HTTP
| Concept | Implementation |
|---|---|
| `provideHttpClient`, `withInterceptors`, `withInterceptorsFromDi` | `src/app/app.config.ts` |
| Functional interceptors (auth, error, retry, loading, logging) | `src/app/core/interceptors/auth.interceptor.ts`, `error.interceptor.ts`, `retry.interceptor.ts`, `loading.interceptor.ts`, `logging.interceptor.ts` |
| Class-based interceptor | `src/app/core/interceptors/correlation-id.interceptor.ts` |
| `HttpContextToken` | `src/app/core/interceptors/http-context.ts` |
| `HttpParams` / `HttpHeaders` | `src/app/core/api/base-api.service.ts`, `src/app/core/api/medical-record-api.service.ts` |
| Typed requests/responses, `observe: 'events'` + `reportProgress` (upload progress) | `src/app/core/api/laboratory-api.service.ts`, `src/app/features/medical-records/medical-documents.component.ts` |
| Blob download | `src/app/core/api/laboratory-api.service.ts`, `src/app/core/services/file.service.ts` |
| Error handling / retry / refresh-and-replay | `src/app/core/models/api-error.ts`, `src/app/core/interceptors/error.interceptor.ts`, `src/app/core/auth/auth.service.ts` |

## 10. Routing
| Concept | Implementation |
|---|---|
| `provideRouter`, `withComponentInputBinding`, scrolling, router config | `src/app/app.config.ts` |
| Routes, nested/child routes, redirects, wildcard + 404 | `src/app/app.routes.ts` |
| Lazy `loadComponent` / `loadChildren` | `src/app/app.routes.ts`, `src/app/features/*/*.routes.ts` |
| Route params, query params, optional params | `src/app/features/prescriptions/prescription-generate.component.ts` (`?patientId=&doctorId=&appointmentId=` as inputs), `src/app/features/billing/billing-details.component.ts` (`:billId`) |
| Route data / breadcrumbs | `src/app/layouts/main-layout/breadcrumbs.component.ts` |
| Resolvers (functional) | `src/app/core/guards/resolvers.ts`, `src/app/features/doctors/doctors.routes.ts` |
| Guards: CanActivate / CanActivateChild / CanMatch / CanDeactivate (functional) | `src/app/core/guards/auth.guards.ts`, `src/app/core/guards/unsaved-changes.guard.ts` |
| Class-based guards | `src/app/core/guards/patient-ownership.guard.ts`, `src/app/features/admin/admin-role.guard.ts` |
| Role / permission based routing | `src/app/core/auth/permissions.ts`, feature `*.routes.ts` |
| Custom preloading strategy | `src/app/core/services/routing-strategies.ts` (`SelectivePreloadingStrategy`) |
| Custom route reuse strategy | `src/app/core/services/routing-strategies.ts` (`ListReuseStrategy`) |
| Auxiliary routes / named outlet | `src/app/app.routes.ts` (`outlet: 'quick'`), `src/app/layouts/main-layout/main-layout.component.ts`, `src/app/features/patients/patient-quick-view.component.ts` |
| Navigation events | `src/app/core/services/navigation-events.service.ts` |
| Programmatic navigation (`navigate`, `navigateByUrl`), relative links | `src/app/features/patients/patient-register.component.ts`, `src/app/features/billing/billing-generate.component.ts` |
| Route-level state selectors | `src/app/state/selectors/router.selectors.ts` |
| Unauthorized handling | `src/app/features/authentication/access-pages.component.ts` |

## 11. Forms
| Concept | Implementation |
|---|---|
| Typed Reactive Forms, nested `FormGroup`s | `src/app/features/patients/patient-form.component.ts` |
| `FormBuilder` / `NonNullableFormBuilder` | `src/app/features/billing/billing-generate.component.ts`, `src/app/features/prescriptions/prescription-generate.component.ts` |
| `FormArray` (dynamic rows) | `src/app/features/prescriptions/prescription-generate.component.ts`, `src/app/features/laboratory/lab-request-new.component.ts`, `src/app/features/doctors/doctor-tabs.component.ts` (weekly schedule) |
| Template-driven forms (`ngModel`, `ngModelGroup`, `ngForm`) | `src/app/features/patients/patient-contact.component.ts`, `src/app/features/notifications/notification-send.component.ts`, `src/app/features/hospitals/hospital-form.component.ts` |
| Built-in + custom sync validators | `src/app/shared/validators/validators.ts` (`phoneValidator`, `pastDateValidator`, `strongPassword`, `dosageValidator`, `timeOrder`, `requiredIf`) |
| Cross-field validators | `src/app/shared/validators/validators.ts` (`matchFields`, `timeOrder`), duplicate-medicine validator in `src/app/features/prescriptions/prescription-generate.component.ts` |
| **Async validator** | `src/app/shared/validators/validators.ts` (`existsInCatalogue`) used in `src/app/features/prescriptions/prescription-generate.component.ts` |
| Conditional validation | `src/app/shared/validators/validators.ts` (`requiredIf`) |
| `valueChanges` / `statusChanges` | `src/app/features/billing/billing-generate.component.ts`, `src/app/features/prescriptions/prescription-generate.component.ts` |
| `ControlValueAccessor` (custom form control) | `src/app/shared/components/quantity-stepper.component.ts` (used in `src/app/features/billing/billing-generate.component.ts`) |
| Signal-based forms | `src/app/shared/utilities/signal-form.ts` (used by `src/app/features/pharmacy/pharmacy-medicine-form.component.ts`, `src/app/features/pharmacy/pharmacy-medicine-details.component.ts`) |
| Error display, disabled/submitting state, unsaved-changes guard | `src/app/features/patients/patient-form.component.ts`, `src/app/core/guards/unsaved-changes.guard.ts` |
| Material form fields, autocomplete, datepicker | `src/app/features/prescriptions/prescription-generate.component.ts`, `src/app/features/patients/patient-form.component.ts` |

## 12. Performance
OnPush (all components) · zoneless · lazy routes + custom preloading · `@defer` · CDK virtual scroll (`src/app/features/medical-records/patient-record.component.ts`) · `track` on every `@for` · `shareReplay` caches (`src/app/features/prescriptions/prescription.service.ts`) · dynamic `import()` (`src/app/features/prescriptions/prescription-export.ts` loaded from the service on demand) · request cancellation (`switchMap`) · debounced search (`src/app/shared/components/search-box.component.ts`) · stale-while-revalidate dashboard (`src/app/features/dashboard/dashboard.component.ts`) · pure vs. impure pipe choice (`src/app/shared/pipes/pipes.ts`).

## 13. UI libraries
| Library | Where |
|---|---|
| Angular Material (table, paginator, sort, dialog, snackbar, sidenav, form fields, autocomplete, datepicker, menu, badge) | `src/app/features/patients/*`, `src/app/features/doctors/*`, `src/app/features/prescriptions/*`, `src/app/layouts/main-layout/main-layout.component.ts` |
| Tailwind | `src/app/features/dashboard/dashboard.component.ts`, `src/app/features/appointments/*`, `src/app/features/notifications/*`; config `tailwind.config.js` |
| PrimeNG (`p-table` lazy, `p-dialog`, `p-select`, `p-tag`, `p-inputnumber`, `p-progressbar`) | `src/app/features/laboratory/*`, `src/app/features/pharmacy/*`, `src/app/features/medical-records/*` |
| Bootstrap (scoped `.bs-scope`) | `src/app/features/hospitals/*`, `src/app/features/billing/*`; scoping in `src/styles/styles.scss` |
| Light/dark themes | `src/app/core/services/theme.service.ts`, `src/styles/styles.scss` |

## 14. TypeScript concepts
| Concept | Implementation |
|---|---|
| Interfaces, type aliases, union types | `src/app/core/models/*.ts` (e.g. `src/app/core/models/billing.ts`) |
| Discriminated unions | `src/app/core/models/api-error.ts` (`LoadState<T>`) |
| Intersection / mapped / utility types (`Partial`, `Record`, `Pick`) | `src/app/shared/utilities/signal-form.ts`, `src/app/core/auth/permissions.ts` (`satisfies Record<…>`) |
| Generics (services, components, helpers) | `src/app/core/api/base-api.service.ts`, `src/app/shared/utilities/load-state.ts`, `src/app/shared/components/state-views.component.ts` |
| Abstract classes, inheritance, polymorphism | `src/app/core/api/base-api.service.ts`, `src/app/core/configuration/app-config.ts` (`NotificationChannel`, `ConsoleLogger` → `QuietLogger`), `src/app/features/patients/patient-tabs.component.ts` (abstract `PatientTab`) |
| Access modifiers, encapsulation (`private`, `protected`, `readonly`) | all services and components |
| Enums | `src/app/core/configuration/app-config.ts` (`LogLevel`) |
| `as const`, type guards, `satisfies` | `src/app/core/models/api-error.ts` (`isApiError`), `src/app/core/auth/permissions.ts` |
| Decorators | `@Component`, `@Directive`, `@Pipe`, `@Injectable`, `@NgModule` throughout |
