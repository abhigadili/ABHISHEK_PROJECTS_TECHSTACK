# 05 · React Hooks (complete catalogue)

## 1. Concept explanation
A Hook is a function (name starts with `use`) that lets a function component "hook into" React features: state, lifecycle,
context, refs, performance, concurrency. Hooks replaced class lifecycle methods and let stateful logic be reused as **custom Hooks**
(doc 09). React version here: **19.3**, so `useActionState`, `useOptimistic` and `useEffectEvent` are real stable APIs.

**Rules of Hooks** (enforced by `eslint-plugin-react-hooks`, which caught a real violation in this project — `DashboardPage` called
`useAppSelector` after an early return; fixed by moving every Hook above the returns):
1. Call Hooks only at the **top level** of a component/custom Hook — never in loops, conditions, nested functions or after an early `return`.
2. Call Hooks only from React functions.

## 2. Syntax — one line each
```ts
const [v, setV] = useState(init);            useEffect(() => { …; return cleanup; }, [deps]);
const ctx = useContext(Ctx);                  const ref = useRef(null);
const [s, dispatch] = useReducer(reducer, init);
const memo = useMemo(() => expensive(a), [a]);  const cb = useCallback(() => fn(a), [a]);
useLayoutEffect(() => measure(), []);         useImperativeHandle(ref, () => ({ focus }), []);
const id = useId();                           const [pending, start] = useTransition();
const deferred = useDeferredValue(text);      const snap = useSyncExternalStore(subscribe, getSnapshot);
const [state, action, pending] = useActionState(fn, init);   const [opt, add] = useOptimistic(state, reducer);
useDebugValue(value, format);                 useInsertionEffect(() => injectCss(), [css]);
const onTick = useEffectEvent(() => read(latest));
```

## 3. Actual EMS implementation (every Hook, with its real use)
| Hook | Practical use in EMS | File(s) |
|---|---|---|
| `useState` | Filters, modal visibility, wizard step, selected org node, view toggle | `EmployeeListPage.tsx`, `hooks/useModal.ts`, `EmployeeFormPage.tsx`, `OrganizationPage.tsx` |
| `useEffect` | Fetch dashboard with abort-on-leave; poll notifications; sync search box ⇄ URL; set `document.title` (lab) | `DashboardPage.tsx`, `hooks/useNotifications.ts`, `EmployeeListPage.tsx` |
| `useContext` | `useAuth`, `useNotify`, `useThemeMode`, `useConfirm`, `useCurrentUser`, `useAppConfig` | `contexts/*.tsx`, `components/dialogs/ConfirmDialog.tsx` |
| `useRef` | Hidden file input (DOM), mutable "abort controller / sequence number", `done` flag for the navigation blocker, render counters in demos | `FileUpload.tsx`, `hooks/useApi.ts`, `EmployeeFormPage.tsx` |
| `useReducer` | Toast queue state machine (`toastReducer`), cart in the lab | `contexts/NotificationContext.tsx`, `features/lab/BasicHooksDemo.tsx` |
| `useMemo` | Theme object, sidebar groups from role, DataTable columns, org search highlight `Set`, report totals | `contexts/ThemeContext.tsx`, `Sidebar.tsx`, `AttendanceReportsPage.tsx`, `OrganizationPage.tsx` |
| `useCallback` | Stable handlers into memoised rows/cards; stable `confirm`, `login`, `logout` in Context values | `EmployeeListPage.tsx`, `ConfirmDialog.tsx`, `AuthenticationContext.tsx` |
| `useLayoutEffect` | Scroll the selected org node into view *before paint* (no visible jump); measure a resizable box | `OrgTree.tsx`, `AdvancedHooksDemo.tsx` |
| `useImperativeHandle` (+`forwardRef`) | `FileUpload` exposes `open()`/`clear()` only (not the `<input>`) | `FileUpload.tsx`, used by `PictureManager.tsx`, `LeaveApplyPage.tsx` |
| `useId` | Unique label↔input ids in every form field and filter select | `components/forms/fields.tsx`, `tables/FilterSelect.tsx` |
| `useTransition` | Non-urgent filter/tab/sort updates keep the UI responsive; async actions in approvals | `EmployeeListPage.tsx`, `ReportsPage.tsx`, `LabPage.tsx`, `LeaveApprovalsPage.tsx` |
| `useDeferredValue` | Employee rows and org-chart search hits render at lower priority than typing | `EmployeeListPage.tsx`, `OrganizationPage.tsx` |
| `useSyncExternalStore` | `localStorage` and `navigator.onLine` as external stores | `hooks/useLocalStorage.ts`, `hooks/useOnlineStatus.ts` |
| `useActionState` | Forgot-password `<form action>` with built-in pending state | `features/auth/ForgotPasswordPage.tsx` |
| `useOptimistic` | Approve/reject removes the row instantly; mark-read flips instantly; both roll back on failure | `LeaveApprovalsPage.tsx`, `NotificationsPage.tsx` |
| `useDebugValue` | Readable labels for `useLocalStorage` / `useOnlineStatus` in React DevTools | `hooks/useLocalStorage.ts`, `hooks/useOnlineStatus.ts` |
| `useEffectEvent` | Notification poller always dispatches with the latest closure without re-subscribing the interval | `hooks/useNotifications.ts` (+ `Ticker` in the lab) |
| `useInsertionEffect` | **Lab only** — its single genuine purpose is CSS-in-JS style injection; EMS has no such need, so it is demonstrated in isolation (`Injected`) | `features/lab/AdvancedHooksDemo.tsx` |

`useInsertionEffect` is deliberately *not* forced into a business screen. Every Hook above has a unit test (`hooks/hooks.test.tsx`,
`features/lab/lab.test.tsx`, `contexts/contexts.test.tsx`, `features/pages.test.tsx`).

## 4. Relevant file paths
`src/hooks/*.ts`, `src/contexts/*.tsx`, `src/features/lab/BasicHooksDemo.tsx`, `src/features/lab/AdvancedHooksDemo.tsx`.

## 5. Practical implementation
`useEffectEvent` removes the classic stale-closure/over-subscription dilemma (`hooks/useNotifications.ts`):
```ts
const tick = useEffectEvent(() => { if (document.visibilityState === 'visible') void dispatch(refreshUnreadCount()); });
useEffect(() => {
  tick();
  const id = setInterval(tick, notificationPollMs);
  document.addEventListener('visibilitychange', tick);
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
}, [notificationPollMs]);       // `tick` is intentionally not a dependency
```
Tested with fake timers: polls immediately and on the interval, and stops after unmount.

## 6. Why the concept is used
Hooks collapse "lifecycle + state + subscriptions" for one concern into one place (e.g. everything about polling lives in one
Hook), instead of being split across `componentDidMount/Update/WillUnmount`.

## 7. Advantages and limitations
**+** Reusable logic, less boilerplate, composable; concurrency Hooks (`useTransition`, `useDeferredValue`) improve perceived performance for free. **−** Dependency arrays are easy to get wrong (stale closures, infinite loops); Hooks can't be conditional; `useMemo`/`useCallback` are optimisations, not semantic guarantees; overusing `useEffect` for derived state is the most common mistake (doc 06).

## 8. Interview-related considerations
* Why can't Hooks be called conditionally? React identifies Hooks by **call order** per component.
* `useState` updater form (`setN(n => n+1)`) vs value; batching (React 18+ batches everywhere).
* `useMemo` vs `useCallback` vs `React.memo`; "premature memoisation".
* `useRef` vs `useState` (ref changes don't re-render). `useLayoutEffect` vs `useEffect` (sync before paint vs after).
* What does StrictMode do to effects? (mount → unmount → mount in dev.) What problem does `useEffectEvent` solve? What does `useSyncExternalStore` prevent? (tearing)
* `useTransition` vs `useDeferredValue`; `useOptimistic`'s automatic rollback.
