# 15 · Protected routes and authorization

## 1. Concept explanation
Front-end authorization answers *"what should this user **see**?"* — it is **user experience, not security**. A determined user can
edit JavaScript, call the API directly, or forge a URL. Therefore:

> **Never depend on React route protection alone. The backend independently validates every permission** (Express `authorize()`
> middleware + data-scope rules in `services/accessScope.js`), and this app is written so a front-end bypass gains nothing.

The UI layers, from coarse to fine:
1. **Authentication guard** — signed in or not (redirect to `/login`, remembering the destination).
2. **Guest-only guard** — signed-in users bounce away from `/login`.
3. **Role guard** — `allowedRoles` on a route.
4. **Permission guard** — a named capability (`'employee:manage'`) mapped from roles.
5. **Permission-based rendering** — hide buttons/menu entries/columns the role can't use.
6. **Unauthorized page** — an explicit `/unauthorized` (403) destination instead of a blank screen.

## 2. Syntax
```tsx
<ProtectedRoute allowedRoles={["HR_ADMIN", "SUPER_ADMIN"]}><EmployeeManagement /></ProtectedRoute>   // inline
{ path: 'new', element: <ProtectedRoute permission="employee:manage" />, children: [{ index: true, lazy: … }] }   // as a layout route (<Outlet/>)
<Can permission="employee:manage"><Button>New employee</Button></Can>                                    // render-level
```

## 3. Actual EMS implementation
| Piece | File |
|---|---|
| `RequireAuth` (protected **layout**; shows "Restoring your session…" while bootstrapping to avoid a login flash; redirects with `state.from`) | `features/auth/guards.tsx` |
| `GuestOnly` (returns users to `state.from` or `/dashboard`) | `features/auth/guards.tsx` |
| `ProtectedRoute({ allowedRoles?, permission?, children? })` — works inline *and* as an `<Outlet/>` layout | `features/auth/guards.tsx` |
| Permission map `PERMISSIONS: Record<Permission, Role[]>` mirroring the backend's `authorize(...)` calls | `constants/roles.ts` |
| `usePermissions()` → `can(permission)`, `hasRole(...)`, `isAdmin`, `isManagerUp` | `hooks/usePermissions.ts` |
| `<Can permission roles fallback>` | `components/common/Can.tsx` |
| Role-based navigation (sidebar entries filtered by permission) | `constants/navigation.tsx` + `components/layout/Sidebar.tsx` |
| Role-aware data: EMPLOYEE has no company dashboard, so a 403 from `/dashboard` becomes a personal summary | `features/dashboard/DashboardPage.tsx`, `EmployeeSelfSummary.tsx` |
| Unauthorized + 404 + route error pages | `features/auth/StatusPages.tsx` |
| Applied to routes | `routes.tsx`: `employees/new`, `employees/:id/edit`, `departments/new|:id/edit` (`employee:manage` / `department:manage`), `leaves/approvals` (roles), `leaves/admin`, `reports`, `attendance/reports`, `users` |

Role capabilities are documented in `docs/backend-api-integration.md` → *Roles and permissions*.

## 4. Relevant file paths
`src/features/auth/guards.tsx`, `src/constants/roles.ts`, `src/hooks/usePermissions.ts`, `src/components/common/Can.tsx`,
`src/app/router/routes.tsx`, tests in `src/features/pages.test.tsx` and `src/hooks/hooks.test.tsx`, `e2e/routes.spec.ts`.

## 5. Practical implementation — verified, not assumed
Unit test (`pages.test.tsx`) is a table: `[role, path, allowed]`, e.g. `['EMPLOYEE','/employees/new',false]`, `['HR_ADMIN','/users',true]`,
`['MANAGER','/leaves/admin',false]` — 11 rows assert the router lands on `/unauthorized` exactly when it should.
Permission test (`hooks.test.tsx`): `it.each` over the four roles verifies `can('users:set-role')` is true **only** for `SUPER_ADMIN`.
E2E (`e2e/routes.spec.ts`) goes further and asserts that a **manager visiting an admin URL causes zero 4xx API calls** — i.e. the UI
refuses *before* asking the backend — and that the backend's own 403 on `/dashboard` for employees is the only tolerated response.
Server-side authority is real: the seeded EMPLOYEE token calling `GET /reports/departments` directly returns 403.

## 6. Why the concept is used
It gives users a coherent experience (no dead buttons, helpful redirects) and reduces useless requests, while keeping the trust
boundary where it belongs — on the server.

## 7. Advantages and limitations
**+** one permission vocabulary (`Permission`) shared by routes, menus and buttons; type-safe (`as const satisfies Record<…>` means a typo is a compile error); guards are reusable and testable. **−** the permission map duplicates the backend's rules and can drift (a test per role + the documented table mitigate that; the server wins); hiding ≠ securing; token claims can be stale until refresh (the backend re-reads the user on every request, so a deactivated account is cut off immediately); manager *data scope* (subtree) is enforced only on the server.

## 8. Interview-related considerations
* Is client-side route protection secure? (No — UX only.) What *is* the security boundary? (API authorization.)
* RBAC vs permission-based vs ABAC; why map roles → permissions instead of checking roles everywhere.
* Where do you redirect after login? (`location.state.from`.) How do you prevent a "login flash" on reload? (bootstrapping flag.)
* How do you handle a 403 vs 401 in the SPA? (401 → refresh/logout; 403 → toast + stay.)
* Protected layout route vs wrapper component; why use `<Outlet/>` in guards.
