# 06 · `useEffect` and the component lifecycle

## 1. Concept explanation
A component goes through **mount → update (re-render) → unmount**. In function components, *rendering* must be pure (props/state in,
JSX out). Anything that reaches **outside** React — network, timers, subscriptions, the DOM, `document.title` — is a *side effect*
and belongs in `useEffect`, which runs **after** the browser has painted.

An effect has three parts: the **setup** function, an optional **cleanup** (runs before the next setup and on unmount), and a
**dependency array** deciding when to re-run.

| Dependency array | Runs | Class equivalent |
|---|---|---|
| omitted | after every render | `componentDidMount` + `componentDidUpdate` |
| `[]` | once after mount (cleanup on unmount) | `componentDidMount` / `componentWillUnmount` |
| `[a, b]` | after mount and whenever `a` or `b` changed | `componentDidUpdate` with a prev-props compare |

Parent/child render behaviour: when a parent re-renders, **all its children re-render** unless wrapped in `memo` and given
referentially-equal props. Effects run **child-first** on mount, and cleanups run before the next effects. In development
**StrictMode** mounts, unmounts and re-mounts every effect once to prove your cleanup is correct.

## 2. Syntax
```tsx
useEffect(() => {
  const ctrl = new AbortController();
  load(ctrl.signal);
  return () => ctrl.abort();            // cleanup
}, [id]);                               // re-run when `id` changes
```

## 3. Actual EMS implementation
| Scenario | Where |
|---|---|
| Mount fetch **with cancellation** when leaving the page | `features/dashboard/DashboardPage.tsx`: `const p = dispatch(fetchDashboard()); return () => p.abort();` |
| Subscribe + clean up (interval, `visibilitychange`) | `hooks/useNotifications.ts` |
| Abort in-flight request on unmount and when args change | `hooks/useApi.ts` (stale-response guard with a sequence number) |
| Debounce timer cleanup | `hooks/useDebounce.ts` (`return () => clearTimeout(id)`) |
| Sync external → local state (URL → search box on back/forward) | `EmployeeListPage.tsx` (`useEffect(() => setText(filters.q), [filters.q])`) |
| Toast auto-dismiss timer | `components/dialogs/ToastHost.tsx` (`ToastItem`) |
| Reset a form when a dialog opens | `DesignationsPage.tsx`, `HolidaysPage.tsx` (`useEffect(() => reset(...), [open, row, reset])`) |
| Visible lifecycle log (function **and** class) | `features/lab/LifecycleDemo.tsx`, tested in `features/lab/lab.test.tsx` |
| StrictMode | `src/main.tsx` wraps `<App/>` in `<StrictMode>` |

**Class → Hooks translation table** (also shown in `features/lab/patterns/LegacyCounter.tsx`):
| Class | Hooks |
|---|---|
| `constructor` / `this.state` | `useState` / `useReducer` |
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate(prev)` | `useEffect(fn, [dep])` (React already gives you the *new* value; keep the old one in a ref if needed) |
| `componentWillUnmount` | the function returned from `useEffect` |
| `shouldComponentUpdate` / `PureComponent` | `React.memo` |
| `getDerivedStateFromProps` | compute during render (or `key` to reset) |
| `getSnapshotBeforeUpdate` | `useLayoutEffect` |
| `componentDidCatch` / `getDerivedStateFromError` | **still a class** → `ErrorBoundary` |

## 4. Relevant file paths
`src/hooks/useApi.ts`, `src/hooks/useNotifications.ts`, `src/hooks/useDebounce.ts`, `src/features/lab/LifecycleDemo.tsx`, `src/main.tsx`.

## 5. Practical implementation — avoiding unnecessary effects
Not everything needs an effect. Compare (from this project):
```ts
// ❌ derived state via effect: extra render + a chance to be stale
const [groups, setGroups] = useState([]); useEffect(() => setGroups(group(items, role)), [items, role]);
// ✅ compute during render (Sidebar.tsx)
const groups = useMemo(() => group(NAV_ITEMS.filter(i => !i.permission || can(i.permission))), [can]);
```
Other "no effect needed" decisions: data fetching for list/detail screens uses **RTK Query** (not `useEffect + fetch`), user events run
logic in **handlers**, resetting a form for another employee uses a **`key`** (`<EmployeeForm key={editId ?? 'new'} …/>`).

## 6. Why the concept is used
Effects are React's escape hatch to synchronise with the outside world, with an explicit contract (setup/cleanup/deps) that makes
leaks (timers, listeners, requests) visible and testable.

## 7. Advantages and limitations
**+** Cleanup contract prevents leaks; dependencies make data flow explicit; StrictMode surfaces bugs early.
**−** Missing/excess dependencies cause stale closures or loops; effects run *after* paint (use `useLayoutEffect` for measure-before-paint); effects are not for derived state or event handling; fetching in raw effects invites race conditions (hence `useApi`'s sequence guard).
Two intentionally-annotated `eslint-disable react-hooks/exhaustive-deps` exist (`useApi` args key, `EmployeeListPage` one-time URL seeding) — each has a comment explaining why.

## 8. Interview-related considerations
* Why does an effect run twice in dev? (StrictMode); how do you make it idempotent? (cleanup)
* Stale closure example and fixes (functional updates, `useRef`, `useEffectEvent`).
* How do you avoid race conditions in fetch effects? (AbortController / ignore flag / sequence id — see `useApi`).
* `useEffect` vs `useLayoutEffect`; when would you *not* use an effect? (derived data, events, resetting state).
* How do parent re-renders affect children, and how do you stop it? (`memo`, stable props, state colocation).
