# 12 · Route guards and resolvers

## 1. Concept explanation
**Guards** decide whether a navigation may happen (`CanActivate`, `CanActivateChild`, `CanDeactivate`, `CanMatch`). **Resolvers** load data *before* the route activates. In current Angular both are plain functions (`CanActivateFn`, `ResolveFn`…) that can call `inject()`.

> **Security note:** guards run in the browser and can be bypassed. They improve UX (no flash of forbidden pages). The Express backend independently authenticates and authorises *every* request, which is the real protection.

## 2. Angular API / syntax
```ts
export const authGuard: CanActivateFn = async (_r, state) => {
  const auth = inject(AuthService);
  await firstValueFrom(auth.sessionReady$, { defaultValue: false });   // wait for startup session restore
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
export const employeeResolver: ResolveFn<Employee> = (route) => inject(EmployeeService).get(Number(route.paramMap.get('id')));
```

## 3. Where it is implemented in EMS (`core/guards/guards.ts`, `core/resolvers/resolvers.ts`)
| Required item | Implementation | Wired in |
|---|---|---|
| Authentication guard | `authGuard` — waits for `sessionReady$`, redirects to `/login?returnUrl=` | shell route (`app.routes.ts`) |
| Guest-only guard | `guestGuard` — logged-in users are sent to `/dashboard` | `/login`, `/forgot-password`, `/reset-password` |
| Authorization / role guard | `roleGuard` — `data: { roles: [...] }` → `/unauthorized` | exercised through `childAccessGuard` and unit-tested; **no route currently declares `data.roles`** — the app's routes use the finer-grained `permissions` instead |
| Permission-based guard | `permissionGuard` — `data: { permissions: [...] }` (any-of) | `reports`, `users`, `attendance/reports`, `leaves/approvals`, `leaves/admin`, `employees/new|edit`, `departments/new|edit` |
| **`CanActivateChildFn`** | `childAccessGuard` — runs role+permission checks for **every descendant** | `canActivateChild` on the shell route |
| **Deactivation guard** (unsaved forms) | `unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges>` — `window.confirm` if the component reports unsaved changes | employee form, department form, leave apply, user create, profile |
| **Resolver-based data loading** | `employeeResolver`, `departmentResolver` (404 → toast + back to list, `EMPTY` cancels navigation) | `employees.routes.ts` `:id`, `departments.routes.ts` `:id` |
| Functional style | all of the above are functions, no classes | – |

Tests: `core/guards/guards.spec.ts` (all guards, redirects, `returnUrl`, any-of logic, confirm/deny), E2E “role-based access and logout” (employee is redirected from `/users` and `/employees/new`; anonymous `/dashboard` → `/login?returnUrl=%2Fdashboard`).

## 4. Relevant file paths
`src/app/core/guards/guards.ts`, `src/app/core/resolvers/resolvers.ts`, `src/app/app.routes.ts`, `src/app/features/*/*.routes.ts`, `src/app/core/services/permission.service.ts`.

## 5. Practical implementation explanation
* **Reload without a login flash.** On startup `provideAppInitializer` starts `AuthService.restoreSession()` (refresh token → new access token → `/auth/me`). It does not block rendering; instead `authGuard` awaits an **`AsyncSubject`** (`sessionReady$`) that emits once when restoration finishes — so a hard reload on `/employees` stays on `/employees`.
* **One implementation of “who can do what”.** Guards, nav items (`layout/nav-items.ts`), and the `*appHasRole`/`*appHasPermission` directives all read `PermissionService`, which mirrors the backend role matrix. Change a rule once.
* **Dirty-form protection** is a tiny contract: components implement `hasUnsavedChanges()`; the generic guard never imports a component.
* **Resolver UX.** A missing/forbidden employee shows a toast and returns to the list instead of a blank detail page.

## 6. Why this concept was selected
Guards + resolvers remove loading/permission branching from components; the deactivation guard prevents silent data loss on the longest form in the app.

## 7. Interview-related considerations
* *Guard return types:* `boolean | UrlTree | Observable | Promise` — returning a `UrlTree` (not calling `navigate`) is the recommended redirect.
* *`canActivate` vs `canActivateChild` vs `canMatch`:* child guard protects an entire subtree once; `canMatch` prevents even loading the lazy chunk.
* *Resolver vs fetching in `ngOnInit`:* resolver blocks activation (no skeleton needed) but delays navigation; fetching in the component shows the shell faster. Used here when the entity is mandatory for the page.
* *Why not trust the guard?* Direct API calls skip it; the backend returns 401/403 and the interceptors handle them (see 17).
* *Why `runGuardsAndResolvers: 'always'` on departments?* Default only re-runs on param change, which would show stale data after an edit.
