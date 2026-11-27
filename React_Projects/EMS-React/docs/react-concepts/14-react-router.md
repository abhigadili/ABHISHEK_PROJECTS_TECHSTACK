# 14 · React Router (v7 data router) — routes, parameters and navigation

## 1. Concept explanation
React Router maps URLs to component trees. This app uses the **data router** (`createBrowserRouter` + `RouterProvider`) so routes
can own **loaders** (fetch before render), **actions** (handle mutations), **error elements**, **lazy** code and **handles**
(metadata, used for breadcrumbs). The URL is part of application state: filters, pagination and the selected record live in it, so
refresh/back/forward/share all work.

## 2. Syntax
```tsx
const router = createBrowserRouter([
  { path: '/', element: <RequireAuth><AppLayout/></RequireAuth>, errorElement: <RouteError/>, children: [   // layout route
    { index: true, element: <Navigate to="/dashboard" replace/> },                                         // index + redirect
    { path: 'employees/:id', loader, action, lazy: async () => ({ Component: (await import('./Page')).default }), handle: { crumb: 'Employee' } },
    { path: '*', element: <NotFoundPage/> },                                                               // wildcard
  ]},
]);
const { id } = useParams();   const [sp, setSp] = useSearchParams();   const navigate = useNavigate();   const loc = useLocation();
```

## 3. Actual EMS implementation
**Route table** — `src/app/router/routes.tsx` (`buildRoutes(store)`; loaders/actions in `app/router/loaders.ts`).

| Required concept | Where |
|---|---|
| Basic routing | `/login`, `/dashboard`, `/holidays`, `/settings`, `/lab`, … |
| **Nested / child routes** | `employees` → (`index`, `new`, `:id` → (`index`, `profile`, `job-history`, `edit`)); same for `departments`, `attendance`, `leaves`, `organization` |
| **Dynamic routes / params** | `employees/:id`, `departments/:id`, `attendance/:id`, `leaves/:id`, `organization/:employeeId` → `useParams()` |
| **Layout routes** | `AppLayout` (header/sidebar/footer + `<Outlet/>`), `EmployeeLayout` (employee header + tabs + `<Outlet context>`), `ProtectedRoute` used as a pathless layout (`element: <ProtectedRoute permission=…/>`) |
| **Index routes** | every feature's list page; `employees/:id` overview |
| **Wildcard** | `path: '*'` inside the layout (404 within the app) and at the top level (404 for guests) |
| **Redirects** | index `/` → `/dashboard` (`<Navigate replace/>`); unauthenticated → `/login`; authenticated on `/login` → previous page or dashboard; forbidden → `/unauthorized` |
| **Lazy-loaded routes** | `lazy: lazyPage(() => import(...))` for every page → one chunk per screen (see doc 23) |
| **Loaders** | `employeeLoader` on `employees/:id`: validates the id, restores the token if needed, primes the RTK Query cache; a 404/403 goes to `errorElement` |
| **Actions** | `departmentStatusAction` on `departments/:id/status` — an *action-only* route posted by `useFetcher` from the departments table (no navigation) |
| **Error boundaries** | `errorElement: <RouteError/>` (root and `employees/:id`); handles `Response` errors, API errors (404/403) and render errors |
| **Navigation state** | `<Navigate state={{ from: location }}>` (login return trip), `navigate('/employees/4', { state: { fromList: true } })` ("Back to list" button), `{ attempted }` on `/unauthorized` |
| **Query / search params** | `useSearchParams` in `hooks/useEmployees.ts` (q, departmentId, designationId, status, sort, page, limit), `AttendancePage.tsx` (from, to, scope, status), `ResetPasswordPage.tsx` (`?token=`) |
| **Breadcrumbs** | `handle: { crumb }` on routes + `useMatches()` in `components/layout/Breadcrumbs.tsx` |
| **Unsaved-changes guard** | `useBlocker` in `EmployeeFormPage.tsx` |

**Route list (adjusted to the real backend):** `/login`, `/forgot-password`, `/reset-password`, `/dashboard`, `/employees`,
`/employees/new`, `/employees/:id`, `/employees/:id/profile`, `/employees/:id/job-history`, `/employees/:id/edit`, `/departments`,
`/departments/new`, `/departments/:id`, `/departments/:id/edit`, `/designations`, `/organization`, `/organization/:employeeId`,
`/attendance`, `/attendance/calendar`, `/attendance/reports`, `/attendance/:id`, `/leaves`, `/leaves/apply`, `/leaves/calendar`,
`/leaves/approvals`, `/leaves/admin`, `/leaves/:id`, `/holidays`, `/reports`, `/notifications`, `/users`, `/profile`, `/settings`,
`/lab`, `/unauthorized`, `*`. (Added vs the suggestion: users, holidays, calendar, admin, lab; `/employees/:id/profile` is a tab.)

## 4. Relevant file paths
`src/app/router/routes.tsx`, `src/app/router/loaders.ts`, `src/hooks/useEmployees.ts`, `src/features/employees/EmployeeLayout.tsx`,
`src/components/layout/Breadcrumbs.tsx`, `src/features/auth/guards.tsx`, `src/features/auth/StatusPages.tsx`.

## 5. Practical implementation — URL as the single source of truth for the employee list
```ts
const [params, setParams] = useSearchParams();
const filters = useMemo(() => parseEmployeeFilters(params), [params]);                // URL → filters
const update = useCallback((patch) => setParams((prev) => { const next = new URLSearchParams(prev);
  for (const [k, v] of Object.entries(patch)) (v === undefined || v === '') ? next.delete(k) : next.set(k, String(v));
  if (!('page' in patch)) next.delete('page');                                        // any filter change → page 1
  return next; }, { replace: true }), [setParams]);
const result = useListEmployeesQuery(query);                                          // filters → server
```
The search box holds *local* text, `useDebounce`s it, and only the debounced value is written to the URL (`EmployeeListPage.tsx`) —
tested: typing "cara" produces `?q=cara` and **no** intermediate requests for `c`, `ca`, `car`.
Loader + `errorElement` is tested too: `/employees/999` → "Employee not found" inside the route error UI.

## 6. Why the concept is used
Shareable/bookmarkable screens, correct Back-button behaviour, route-level code-splitting, data loaded *before* the screen paints, and
declarative error handling per route subtree.

## 7. Advantages and limitations
**+** loaders/actions/errorElement remove most `useEffect` fetching and spinner waterfalls; nested layouts avoid re-mounting shells;
search params make state durable. **−** loaders run **before** auth bootstrap on a hard reload (we restore the token inside the loader to avoid a 401); mixing loaders with RTK Query means two cache layers cooperate (the loader just *primes* RTK's cache); URL state is strings — parse/validate it (`parseEmployeeFilters`); lazy routes add a network hop on first visit (Suspense fallback).

## 8. Interview-related considerations
* `BrowserRouter` vs data router (`createBrowserRouter`); what loaders/actions/fetchers replace.
* `Link` vs `NavLink` vs `Navigate` vs `useNavigate` (declarative vs imperative); `replace` semantics.
* Layout routes and `<Outlet>`; `useOutletContext` vs Context vs props (see doc 08).
* Route params are always strings → convert/validate (`Number(id)`, `Number.isInteger`).
* How do you code-split by route? (`lazy`). How do you handle 404 vs 403? (wildcard vs guarded route + `errorElement`.)
* Why are URL query params better than component state for filters?
