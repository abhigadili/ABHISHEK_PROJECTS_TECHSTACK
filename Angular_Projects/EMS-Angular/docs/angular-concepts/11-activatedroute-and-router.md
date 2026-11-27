# 11 · `ActivatedRoute` and `Router`

## 1. Concept explanation
`ActivatedRoute` describes the route a component is rendered for: params, query params, data, URL segments, plus links to parent/child routes. Each of those exists as a **snapshot** (value at one moment) and as an **Observable** (emits when it changes while the component stays alive). `Router` navigates programmatically and exposes events and the router state.

## 2. Angular API / syntax
```ts
route.snapshot.paramMap.get('id') · route.paramMap (Observable) · route.queryParamMap · route.data · route.parent · route.firstChild
router.navigate([], { relativeTo: route, queryParams: { page: 2 }, queryParamsHandling: 'merge', state: { from } })
router.getCurrentNavigation()?.extras.state · router.createUrlTree(...) · router.events
```

## 3. Where each is demonstrated
| Practical example from the brief | Implementation |
|---|---|
| Retrieve an employee by id from route params | `employeeResolver` reads `route.paramMap.get('id')` (`core/resolvers/resolvers.ts`); `attendance-detail`, `leave-detail`, `user-details` receive `:id` as an **input** (component input binding) |
| Keep employee filters & pagination in query params | `employee-list.component.ts`: `route.queryParamMap` (Observable) → `store.applyParams()`; user actions → `router.navigate([], { queryParams, queryParamsHandling: 'merge' })` |
| Open an employee profile from the listing | row click → `open(e)` → `router.navigate(['/employees', e.id], { state: { from: router.url } })`; name link `routerLink`; card view `selected` output |
| Navigate between details, edit and history | `routerLink="overview|history|background"` tabs (`employee-details.component.ts`), `['edit']`, `['profile']` relative links |
| Retrieve route-specific permissions / metadata | `route.data['roles'|'permissions']` in `core/guards/guards.ts`; `route.data['employee']` in `breadcrumb.service.ts` and `employee-form.component.ts` (`route.snapshot.data['employee']`) |
| Route **snapshots** | `login.component.ts` (`route.snapshot.queryParamMap.get('returnUrl')`), `reset-password.component.ts` (token), `employee-form.component.ts` |
| Parameter **observables** | `organization.component.ts` (`route.paramMap` → `selectedId` signal; selection changes without recreating the component) |
| Query-param observables | employee list, `calendar-page.component.ts` (`?view=`) |
| **Parent / child route access** | `employee-tabs.component.ts` → `route.parent?.parent?.snapshot.paramMap.get('id')` (history tab falls back to the URL id); `employee-details.component.ts` reads resolver data from `route.data`; guards read **merged** parent+child data |
| Route data | `route.data.pipe(map(d => d['employee']))` in `employee-details`, `employee-profile` |
| Programmatic navigation | everywhere after saves (`router.navigate(['/employees', saved.id])`), after login (`router.navigateByUrl(target)`) |
| **Navigation state** | `state: { from }` → `employee-details.component.ts` reads `router.getCurrentNavigation()?.extras.state` (falls back to `history.state`) to render “Back to filtered list” with the original query string |
| Router events | `BreadcrumbService` (`NavigationEnd`) |

## 4. Relevant file paths
`src/app/features/employees/employee-list.component.ts`, `employee-details.component.ts`, `employee-tabs.component.ts`, `src/app/features/organization/organization.component.ts`, `src/app/core/guards/guards.ts`, `src/app/features/auth/login.component.ts`.

## 5. Practical implementation explanation
* **Snapshot vs observable rule used here:** snapshot when the component is always recreated for a new value (login `returnUrl`, the edit form's resolver data); observable when the *same instance* survives navigation (the org chart selection, list filters).
* **Open-redirect protection.** After login the `returnUrl` is honoured only if it starts with `/` and not `//` (`login.component.ts#target`).
* **Why `queryParamsHandling: 'merge'`.** Changing the search text must not drop `sort` or `departmentId`; passing `null` for a key removes just that key (`clearFilters()`, paging reset `page: null`).
* **State is passed, not stored.** `state: { from }` is browser-history state, so a refresh keeps it but a shared link doesn't need it (the fallback is the plain list).

## 6. Why this concept was selected
Putting list state in the URL (rather than a service) gives free deep-linking, back/forward support and reload survival; `ActivatedRoute` is the one API that exposes it.

## 7. Interview-related considerations
* *Snapshot vs Observable* — snapshot does not update if the route is reused with new params; observables do.
* *Why can `route.params` miss parent params?* By default children don't inherit; the app sets `paramsInheritanceStrategy: 'always'`.
* *`navigate` vs `navigateByUrl` vs `createUrlTree`?* Command array (relative links, query handling) vs absolute string vs building a `UrlTree` for guards to return.
* *`router.navigate([], …)`* with empty commands changes only query params of the current route.
* *`getCurrentNavigation()`* is only available during the navigation (constructor time), which is why the details component captures it in its constructor.
