# 04 · Services and dependency injection

## 1. Concept explanation
A **service** is a class that holds reusable logic or state (HTTP access, authentication, caching). **Dependency injection (DI)** lets Angular construct and supply those classes (and values) to whoever asks. DI is **hierarchical**: an injector looks in the component/element injector first, then route and environment injectors, up to the root.

## 2. Angular API / syntax
```ts
@Injectable({ providedIn: 'root' })                       // app-wide singleton, tree-shakable
export class EmployeeService { private readonly api = inject(ApiService); }   // inject() function

constructor(@Inject(SESSION_STORAGE) private readonly storage: Storage) {}     // constructor injection + token

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { providedIn: 'root', factory: () => environment.apiBaseUrl });

@Component({ providers: [EmployeeListStore] })            // component-level instance
{ path: ':id', providers: [EmployeeDetailsState], … }     // route-level instance
{ provide: ErrorHandler, useClass: GlobalErrorHandler }   // swapping an implementation
```

## 3. Where it is implemented in EMS
| Feature | File |
|---|---|
| One service per feature (never one generic API service) | `core/services/{auth,employee,department,designation,attendance,leave,organization,notification,dashboard,report,profile,holiday}.service.ts` |
| Thin typed HTTP gateway (URL/envelope/timeout/retry only) | `core/services/api.service.ts` |
| `providedIn: 'root'` | every file in `core/services/` |
| `inject()` function | almost every class (`inject(ApiService)`, `inject(Router)`) |
| **Constructor injection** | `core/services/token-storage.service.ts` (`@Inject(SESSION_STORAGE)`) |
| InjectionTokens | `core/tokens/tokens.ts`: `API_BASE_URL`, `APP_CONFIG`, `BROWSER_STORAGE`, `SESSION_STORAGE` |
| Environment-based config | `src/environments/environment*.ts` → tokens (`fileReplacements` in `angular.json` for dev) |
| Component-level provider | `employee-list.component.ts` → `providers: [EmployeeListStore]` |
| Route-level provider | `employees.routes.ts` → `providers: [EmployeeDetailsState]` on `:id` |
| Hierarchical lookup / optional injection | `EmployeeFormComponent` → `inject(EmployeeDetailsState, { optional: true })` (present under `:id`, absent under `/new`) |
| Custom abstraction | `TokenStorageService` (hides *where* the refresh token lives), `PictureService` (blob cache), `ToastService` (wraps MatSnackBar) |
| Replacing a built-in | `GlobalErrorHandler` (`ErrorHandler`), `AppTitleStrategy` (`TitleStrategy`), `SelectivePreloadingStrategy` (`PreloadingStrategy`) — all wired in `app.config.ts` |

## 4. Relevant file paths
`src/app/core/tokens/tokens.ts`, `src/app/app.config.ts`, `src/app/core/services/*`, `src/app/features/employees/employee-list.store.ts`, `src/app/features/employees/employee-details.state.ts`.

## 5. Practical implementation explanation
* **Tokens for configuration.** `API_BASE_URL` and `APP_CONFIG` have root factories reading `environment`. Specs override them (`interceptors.spec.ts` swaps `API_BASE_URL` for an absolute URL to prove cross-origin behaviour). `BROWSER_STORAGE`/`SESSION_STORAGE` abstract `localStorage`/`sessionStorage` so tests use `MemoryStorage` and no spec touches real storage.
* **Scope as design.** `AuthService` is a root singleton (one session). `EmployeeListStore` is *component*-scoped: leaving and returning to `/employees` gives a fresh store with fresh filters — impossible with a root singleton without manual resetting. `EmployeeDetailsState` is *route*-scoped: opening `/employees/4` then `/employees/9` creates separate instances and they are destroyed with the route.
* **Why `ApiService` stays dumb.** Feature services own their endpoints and mapping; `ApiService` only builds URLs, unwraps `{success,data,meta}`, applies `timeout`, and retries *transient GET* failures — so no business rule leaks into a shared class.
* **Circular dependency avoided.** `AuthService → ApiService → HttpClient → interceptors → AuthService` is safe because interceptor functions `inject(AuthService)` lazily at request time, not at construction.
* **Both injection styles on purpose.** `inject()` is the house style (works in field initialisers, functional guards/interceptors/resolvers); one class uses constructor injection to show the decorator form with a token.

## 6. Why this concept was selected
Tokens + factories give environment-driven configuration without globals; scoped providers give correct lifetimes; one service per feature keeps components thin and tests focused (each service has its own spec).

## 7. Interview-related considerations
* *`providedIn:'root'` vs providing in a component?* Root = singleton, tree-shakable; component provider = instance per component *and its children*, destroyed with it.
* *How does hierarchical DI resolve?* Element/component injector tree → route environment injector → root environment injector → platform. The first match wins; `optional`, `self`, `skipSelf`, `host` modify the walk.
* *`inject()` vs constructor?* `inject()` works in any injection context (field initialisers, functional guards) and avoids constructor signatures when inheriting.
* *What is an `InjectionToken` for?* Injecting non-class values (config, interfaces, `Storage`) with type safety and optional factories.
* *Why `useClass` for `ErrorHandler`?* DI lets you replace framework behaviour without touching framework code.
