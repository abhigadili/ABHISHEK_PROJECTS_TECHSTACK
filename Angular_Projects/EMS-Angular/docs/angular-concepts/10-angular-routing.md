# 10 · Angular routing

## 1. Concept explanation
The router maps URLs to components, supports nesting (child routes render in a parent's `<router-outlet>`), lazy loading, guards, resolvers and metadata. The URL is also **application state** (filters, selection, pagination) and is shareable/bookmarkable.

## 2. Angular API / syntax
```ts
{ path: 'employees', data: { breadcrumb: 'Employees' }, loadChildren: () => import('./features/employees/employees.routes').then(m => m.EMPLOYEE_ROUTES) }
{ path: ':id', providers: [EmployeeDetailsState], resolve: { employee: employeeResolver }, children: […] }
provideRouter(routes, withComponentInputBinding(), withPreloading(Selective…), withRouterConfig({ paramsInheritanceStrategy: 'always' }))
```

## 3. Where it is implemented in EMS
Route map (actual — backend-driven adjustments of the suggested list):

```
/login /forgot-password /reset-password            guest-only (guestGuard)
(shell: authGuard + childAccessGuard)
/dashboard
/employees  /employees/new  /employees/:id (→ overview | history | background)  /employees/:id/edit  /employees/:id/profile
/departments  /departments/new  /departments/:id  /departments/:id/edit
/designations
/attendance  /attendance/reports  /attendance/:id
/leaves  /leaves/apply  /leaves/approvals  /leaves/admin  /leaves/:id
/organization  /organization/:employeeId           (single UrlMatcher route)
/calendar?view=attendance|leave|holidays           (calendar + holidays)
/notifications  /reports  /users  /users/new  /users/:employeeId
/profile  /profile/change-password  /settings
/unauthorized   **  (not found)
```
Static segments (`/attendance/reports`, `/leaves/apply|approvals|admin`, `/employees/new`, `/departments/new`, `/users/new`) are declared **before** their `:id` sibling so they aren't parsed as ids.

| Capability | Where |
|---|---|
| Basic routing, default & redirects | `app.routes.ts` (`'' → dashboard`), `employees.routes.ts` (`'' → 'overview'`) |
| Route params / query params | `:id` everywhere; employee list filters in the query string |
| Child & nested routes | `employees.routes.ts` (shell → tabs), `departments.routes.ts` (`:id` → details / edit) |
| Lazy loading | **every feature** via `loadChildren` (employees, departments, attendance, leaves, organization, holidays, users, profile) and `loadComponent` (login, dashboard, designations, notifications, reports, settings, errors) |
| Route data | `data: { breadcrumb, permissions, preload }` |
| Wildcard | `{ path: '**', loadComponent: NotFoundComponent }` |
| Resolvers | `core/resolvers/resolvers.ts` (`employeeResolver`, `departmentResolver`) |
| Guards | see 12 |
| Programmatic navigation | `Router.navigate([...], { queryParams, queryParamsHandling:'merge', state })` in lists, forms, dialogs |
| Router events | `breadcrumb.service.ts` (`NavigationEnd`) |
| **Custom `UrlMatcher`** | `organization.routes.ts` — one route serves `/organization` and `/organization/:employeeId` so the loaded tree is reused while the selection changes |
| Titles | `title:` per route + `AppTitleStrategy` (“Page · EMS”) |
| Preloading | `core/preloading.ts` `SelectivePreloadingStrategy` (see 22) |
| Component input binding | `withComponentInputBinding()` — `:id` and resolver data arrive as `input()`s in `attendance-detail`, `leave-detail`, `user-details`, `department-form/details` |
| Route reuse | the UrlMatcher + same-component reuse above; a custom `RouteReuseStrategy` was **not** needed and is not implemented |

## 4. Relevant file paths
`src/app/app.routes.ts`, `src/app/app.config.ts`, `src/app/features/*/*.routes.ts`, `src/app/core/resolvers/resolvers.ts`, `src/app/core/services/breadcrumb.service.ts`.

## 5. Practical implementation explanation
* **Role/permission metadata in `data`.** `{ path: 'reports', data: { permissions: ['report.view'] } }`; the shell declares `canActivateChild: [childAccessGuard]`, which reads the merged route data. Because `paramsInheritanceStrategy: 'always'` merges parent `data` into children, a guarded parent protects every descendant.
* **Stale resolver data.** Resolvers re-run only when params change by default. After editing a department the details page must refetch, so that route sets `runGuardsAndResolvers: 'always'`; the employee tabs instead share a route-scoped state that the edit form updates (cheaper: no refetch per tab click).
* **Breadcrumbs without hard-coding names.** Static labels come from `routeConfig.data.breadcrumb`; `:id` routes show the *resolved* entity's name (`data['employee'].fullName`).
* **URL as state.** `/employees?q=eve&departmentId=1&sort=joiningDate:desc&page=2` reproduces the exact view after reload or when pasted; E2E checks the reload.

## 6. Why this concept was selected
Lazy feature routes keep the initial bundle small (≈255 kB transferred); route data + guards centralise access rules; URL-driven filters make lists shareable.

## 7. Interview-related considerations
* *`loadComponent` vs `loadChildren`?* Single component vs a route subtree (own providers/guards/children).
* *Route order matters* — first match wins (`new` before `:id`).
* *`pathMatch: 'full'` on redirects* — otherwise `''` prefixes every URL.
* *Why not rely on guards for security?* They run in the browser; the Express API independently authorises every call.
* *Custom `UrlMatcher`* when the shape isn't expressible as static/`:param` segments, or to reuse a component across URL shapes.
* *`withComponentInputBinding` caveat:* names must match (`id`, `department`); required inputs fail loudly if the route doesn't supply them.
