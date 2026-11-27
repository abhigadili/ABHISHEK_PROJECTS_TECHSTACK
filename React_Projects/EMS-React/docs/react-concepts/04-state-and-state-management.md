# 04 · State and state management (and the state-ownership strategy)

## 1. Concept explanation
**State** is data that changes over time and, when it changes, must update the screen. React gives you component-local state
(`useState`, `useReducer`); everything else is a *placement decision*. This project uses four homes for state and one rule:
**the same information is never stored in two homes.**

| Home | Use it when | EMS examples |
|---|---|---|
| **Local** (`useState`/`useReducer`/`useRef`) | Only one component (or its children) cares; resets on unmount | dialog open/close (`useModal`), search text, wizard step, hover, form drafts |
| **URL** (search params) | The state should survive refresh/back/share | employee filters + page (`hooks/useEmployees.ts`), attendance range (`AttendancePage`) |
| **Context** | Rarely changing, read by many distant components, no complex transitions | theme, app config, toasts, current-user display data, auth façade |
| **Redux Toolkit slice** | Cross-feature client state, command workflows, predictable transitions, devtools/time-travel | session, check-in workflow, dashboard snapshot, unread badge, department filter, row selection, employee directory |
| **RTK Query** | Server data: caching, de-duplication, invalidation, polling | everything fetched by list/detail screens |

## 2. Syntax
```ts
const [open, setOpen] = useState(false);                 // local
const [state, dispatch] = useReducer(toastReducer, []);   // local state machine
const user = useAppSelector((s) => s.auth.user);          // Redux read (typed hook)
const { data } = useListEmployeesQuery(filters);          // server state
const [params, setParams] = useSearchParams();            // URL state
```

## 3. Actual EMS implementation — who owns what
| Data | Owner | File |
|---|---|---|
| Access/refresh tokens | `tokenStore` (module memory + localStorage), **not** React state | `api/tokenStore.ts` |
| Session user/status/error | Redux `authSlice`; exposed through `AuthenticationContext` | `store/slices/authSlice.ts`, `contexts/AuthenticationContext.tsx` |
| Employee **pages** (list/detail), departments, designations, leave, attendance history, holidays, reports, notification **list** | RTK Query | `store/api/emsApi.ts` |
| Dashboard snapshot | `dashboardSlice` (only the dashboard reads it → no duplicate in RTK Query) | `store/slices/dashboardSlice.ts` |
| Today's attendance + in-flight check-in/out | `attendanceSlice` (a *command* workflow, not a cacheable GET) | `store/slices/attendanceSlice.ts` |
| Unread badge count | `notificationSlice` (needed on every screen + polled) | `store/slices/notificationSlice.ts` |
| Normalised employee **directory** for pickers | `employeeSlice` (`createEntityAdapter`); the paged table is RTK Query — different shapes/purposes | `store/slices/employeeSlice.ts` |
| Department filter across screens | `departmentSlice` | `store/slices/departmentSlice.ts` |
| Leave status filter, year, calendar month | `leaveSlice` | `store/slices/leaveSlice.ts` |
| Theme / toasts / config / display name | Contexts | `contexts/*.tsx` |
| Employee filters + pagination | URL | `hooks/useEmployees.ts` |
| Education/experience/skills | `localStorage` (no API) | `services/qualificationsStore.ts` |

State is **reset on logout** — the root reducer wrapper in `app/store/store.ts` drops every slice and the RTK Query cache so the next
user of the browser can't see the previous user's data (tested in `store/slices/slices.test.ts`).

## 4. Relevant file paths
`src/app/store/store.ts`, `src/store/**`, `src/contexts/**`, `src/hooks/useEmployees.ts`, `src/hooks/useModal.ts`.

## 5. Practical implementation — derive, don't store
Anything computable from state is computed, not stored (no `useEffect` that copies state into more state):
```ts
export const selectDirectoryForDepartment = createSelector(
  [directorySelectors.selectAll, selectDepartmentFilter],
  (all, deptId) => (deptId == null ? all : all.filter((e) => e.departmentId === deptId)));
```
and the Sidebar derives its visible menu with `useMemo` from the role, not from a `useState` kept in sync.

## 6. Why the concept is used
Placing state at the right level gives: no stale copies, no wasted re-renders (a slow-changing Context never wakes the table),
shareable URLs, and free caching for server data. The *wrong* placement is the #1 source of React bugs.

## 7. Advantages and limitations
**+** Clear ownership, predictable debugging (Redux DevTools shows every transition), minimal duplication.
**−** More concepts to learn than "one store for everything"; two transports (Axios thunks and RTK Query) must share the session
(they do — one refresh promise, `api/httpClient.ts#refreshSession`). A rule of thumb to remember: *server data → RTK Query; shared
client state → Redux; static/slow values → Context; everything else → local.*

## 8. Interview-related considerations
* **Server state vs client state** (cache invalidation vs UI state) — why RTK Query/React Query exist.
* Lifting state vs Context vs Redux; "do I need Redux?" (not for small apps; yes for cross-feature workflows, devtools, middleware).
* Derived state anti-pattern (`useEffect(() => setX(f(y)), [y])`) → compute during render / `useMemo` / selector.
* State colocation: keep state as close as possible to where it is used (the search box text is local; only the *debounced* value goes to the URL).
* Immutability: why mutating state breaks `memo`/selectors; how Immer in RTK lets you write "mutations" safely.
