# 29 · Testing React (Vitest, React Testing Library, msw, Playwright)

## 1. Concept explanation
* **Unit / component tests** (Vitest + React Testing Library): render a component, interact like a user (`userEvent`), assert what the user
  sees (roles, labels, text). RTL deliberately discourages testing implementation details.
* **msw (Mock Service Worker)** intercepts HTTP at the network layer, so the **real** Axios/RTK Query code, interceptors and reducers run;
  only the server is faked. `onUnhandledRequest: 'error'` makes any unmocked request fail the test (it found a wasted `/departments` fetch for roles that don't need it).
* **E2E** (Playwright): a real browser against the **real Express backend and an isolated test database** — proves the wiring that mocks can't
  (CORS/proxy, JWT, DB constraints, multipart, rate limits, routing).

Current totals: **259 unit/component tests in 10 files** + **20 Playwright tests in 3 specs** (all passing; see the completion report).

## 2. Syntax
```tsx
renderApp('/leaves/approvals', 'MANAGER');                                         // real router + providers + guards, logged-in as a role
server.use(http.get(`${API}/employees`, () => page(employees)));                   // per-test backend behaviour
await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
expect(await screen.findByText('Leave approved')).toBeInTheDocument();
const { result } = renderHook(() => useDebounce(v, 300));  act(() => vi.advanceTimersByTime(300));
```

## 3. Actual EMS implementation (map to the requirement list)
Infrastructure: `vite.config.ts` (jsdom, setup file, absolute fake API origin), `src/test/setup.ts` (stubs for `ResizeObserver`, `matchMedia`,
`scrollIntoView`, `URL.createObjectURL`; msw lifecycle; token + storage reset), `src/test/server.ts` (`ok/page/fail` envelope helpers), `src/test/fixtures.ts`,
`src/test/utils.tsx` (`renderApp`, `renderWithProviders`, `storeFor(role)`, `useLayoutHandlers`).

| Required area | Tests | File |
|---|---|---|
| **Login** | validation messages; bad credentials show the server message **and the form survives** (regression); success returns to the original URL | `features/pages.test.tsx` |
| **Dashboard** | KPIs from backend data; EMPLOYEE 403 → personal summary; error + retry | `pages.test.tsx` |
| **Employee listing** | rows + count, row click → loader + detail, **debounced search → URL**, URL filters → request, empty/error/permission states, 404 loader | `pages.test.tsx` |
| **Employee create/edit** | step validation (`trigger`), **async duplicate email**, **dynamic field array** add/validate/remove, payload shape (no `workLocation:null`), server-error mapping, edit pre-fill | `pages.test.tsx` |
| **Department management** | list, **route action via fetcher**, role gating, create-form validation + 409, uppercase-as-you-type | `pages.test.tsx` |
| **Attendance** | check-in updates card + enables check-out; server refusal shown; correction offered to admins only | `pages.test.tsx` |
| **Leave application** | balance hint, date-range error, payload, server rule shown; history filter; **approvals with optimistic removal + rollback**; own request can't be approved | `pages.test.tsx` |
| **Organization chart** | built from data; expand/collapse; selection + reporting chain + highlight; search reveals match; empty state | `pages.test.tsx` |
| **Notifications** | list, optimistic mark-read, empty | `pages.test.tsx` |
| **Custom auth hooks / employee hooks / pagination / debounce / permission / shared-state hooks** | `useAuth`, `usePermissions` (table over 4 roles), `useEmployees` (URL⇄query), `usePagination`, `useDebounce` (fake timers + unmount cleanup), `useLocalStorage` (cross-tab), `useApi` (abort, stale guard), `useNotifications` (polling), `useFormValidation`, `useDepartments`, `useOnlineStatus`, `useModal` | `hooks/hooks.test.tsx` |
| **Services** | auth, employee (verbs, multipart `file`, Blob, 404→null), department, designation, attendance, leave (multipart/blob), organization (cancel), notification, dashboard, profile, CSV, qualifications store | `services/services.test.ts` |
| **Redux reducers / selectors / async thunks** | all 7 slices; Immer immutability; entity adapter; memoised selector identity; thunk pending/fulfilled/rejected; `condition`; logout reset | `store/slices/slices.test.ts` |
| **RTK Query** | envelope unwrap + meta, query params, dedupe, cache hit, **tag invalidation → refetch**, normalised errors, 401 refresh-and-replay, `forceRefetch` | `store/api/emsApi.test.tsx` |
| **Context providers** | toast reducer + portal + auto-dismiss, split-context render count, global 403 → toast, theme persistence, config overrides, Auth→User composition, guard-hook errors | `contexts/contexts.test.tsx` |
| **Zod schemas** | all schemas, `it.each` weak passwords, per-row array errors, cross-field/conditional/async rules | `schemas/schemas.test.ts` |
| **Dynamic field arrays** | UI test in `pages.test.tsx`; E2E in `e2e/ems.spec.ts` | — |
| **Protected routes** | real route table: guest redirect + remembered URL, 11-row role×path table, sidebar filtering, 404, logout | `pages.test.tsx` |
| **Axios interceptors** | token attach/exemptions/foreign origin, refresh+replay, **single-flight**, failure→logout, loop prevention, status mapping, toast dedupe, skip flag, network error, cancel, `logout-all` regression | `api/httpClient.test.ts` |
| **Error boundaries** | catch/log/report, recover, `resetKeys`, custom fallback, **handlers not caught** | `components/components.test.tsx` |
| Components | `DataTable`, `ConfirmProvider`, `FileUpload` (+imperative handle), `VirtualList`, `Can`, `EmployeeCard`, `SearchBox`, CSV/date utils | `components/components.test.tsx` |
| React Lab concepts | every Hook demo, lifecycle (function + class), controlled/uncontrolled, HOC, render prop, compound, keys, memo, portal, boundary | `features/lab/lab.test.tsx` |
| **E2E (Playwright)** | login · dashboard · create employee · view · edit · search/filters · apply leave · approve leave · attendance check-in · org chart · logout (+ role access, profile-picture multipart, session survives reload, all-routes console/network sweep for 3 roles, refresh under 4-second tokens, revoked-session logout) | `e2e/ems.spec.ts`, `routes.spec.ts`, `refresh.spec.ts` |

## 4. Relevant file paths
`vite.config.ts`, `src/test/*`, `src/**/*.test.ts(x)`, `playwright.config.ts`, `e2e/*.ts`, `scripts/e2e-seed.mjs`.

## 5. Practical implementation — what testing actually caught here
The live E2E and the msw tests found **real bugs** that code review had missed (all fixed, each with a regression test):
1. Failed login unmounted the login page (the "restoring session" flag was reused for login-in-flight).
2. Unsaved-changes blocker fired on a *successful* save (`isSubmitSuccessful` is set after `navigate`).
3. RTK Query errors weren't recognised as `ApiError` → server field errors and 409 handling never reached the forms.
4. `/auth/logout-all` never got a token (prefix match against `/auth/logout`) → "Sign out of all devices" was broken.
5. Clicking the department status switch also opened the department (event bubbling to the row).
6. Hard reload on `/employees/:id` ate a 401 before the refresh (loader ran before the token existed); avatar requests 404-spammed users without a picture.
7. `AuthenticationProvider` re-bootstrapped on every mount (and twice in StrictMode).
Also: a Rules-of-Hooks violation found by ESLint (`DashboardPage`).

Run it: `npm test` · `npm run e2e` (README → Testing for the isolated-backend setup).

## 6. Why the concept is used
Mocked unit tests prove logic; E2E proves integration. Running the *real* interceptors/reducers under msw means the tests exercise the same
code paths as production instead of mocking the module under test.

## 7. Advantages and limitations
**+** user-centric assertions survive refactors; msw keeps tests realistic without a server (the 259 tests run in ≈ 50 s here; most of that is the route-table page tests, which lazy-compile each page and type into real forms); E2E found integration bugs unit tests couldn't. **−** jsdom isn't a browser (no layout: the sweep/Playwright covers that); msw handlers can drift from the real API (E2E and the documented contract mitigate); async UI needs `findBy*`/`waitFor` discipline; E2E is slower and needs the isolated backend + Chrome (`E2E_CHANNEL=chrome`); the jsdom major version is pinned (26) for Node 20.11 compatibility; no coverage gate is enforced.

## 8. Interview-related considerations
* Test behaviour, not implementation: why `getByRole` over `getByTestId`; `findBy` vs `waitFor` vs `getBy`; why `userEvent` over `fireEvent`.
* How do you test a custom Hook (`renderHook`, `act`), timers (`vi.useFakeTimers`), Context providers, Redux (real store vs mock), RTK Query (msw)?
* Mocking strategy: mock the network, not your own modules. What does `onUnhandledRequest: 'error'` buy you?
* Unit vs integration vs E2E pyramid; flaky-test causes (races, shared data — e.g. unique leave dates per E2E run).
* How would you test an error boundary, a portal, an optimistic update + rollback?
