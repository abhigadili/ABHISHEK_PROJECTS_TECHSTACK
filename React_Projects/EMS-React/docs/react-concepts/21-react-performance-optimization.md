# 21 · React performance optimization (reconciliation, rendering, bundles)

## 1. Concept explanation
**How React renders.** A state change re-runs the component function (render phase) producing a new element tree — the **virtual DOM**.
React **reconciles** it against the previous tree: same element type + same position/`key` → *update in place*; different type or key →
*unmount and remount*. Only real differences are committed to the browser DOM. A parent re-render re-renders **all** its children
unless they are wrapped in `memo` and receive referentially-equal props.

**Order of optimisation (what this project did, in this order):** (1) put state where it's used (colocation), (2) don't render what
isn't visible (lazy routes, collapsed org branches, windowed lists), (3) render less urgent work later (`useTransition`,
`useDeferredValue`, debouncing), (4) memoise *only with evidence* (`memo`, `useMemo`, `useCallback`, memoised selectors).
> *Do not add memoisation everywhere without evidence of a benefit.* Each use below states the problem it solves; most components are
deliberately **not** memoised.

## 2. Syntax
```tsx
const Row = memo(function Row({ label, onPick }: Props) { … });          // skip re-render when props are shallow-equal
const onPick = useCallback((l: string) => setPicked(l), []);              // stable function identity
const total = useMemo(() => rows.reduce(…), [rows]);                      // cache an expensive derivation
const Page = lazy(() => import('./Page'));  <Suspense fallback={<Loading/>}><Page/></Suspense>   // code splitting
```

## 3. Actual EMS implementation (and the evidence)
| Technique | Where & why |
|---|---|
| **State colocation** | search text is local to `SearchBox`'s parent; only the *debounced* value reaches the URL/store, so typing re-renders one component (`EmployeeListPage.tsx`) |
| **Debounced search** | `hooks/useDebounce.ts` (350 ms employees, 300 ms org/users/departments). Test asserts typing "cara" never sends `c`/`ca`/`car` to the API |
| **`useDeferredValue`** | employee rows (`EmployeeListPage`) and org-search hits (`OrganizationPage`) render at lower priority than input |
| **`useTransition`** | filter/sort/tab changes marked non-urgent (employees, reports, attendance reports, lab) → table dims (`isPending`) instead of freezing |
| **`React.memo` + stable props** | `DataRow` in `DataTable`, `EmployeeCard`, `ProfilePicture`, `OrgTreeNode`, `DashboardCharts`, `ExpensiveChild`/`Row` demos. Rows get `useCallback` handlers, so selecting one row doesn't re-render the others |
| **`useMemo`** | MUI theme (`ThemeContext`), sidebar groups, table columns, org `highlightIds` Set, report totals, Context values |
| **`useCallback`** | handlers passed to memoised children; Context actions (`login`, `confirm`, …) |
| **Memoised selectors** | `createSelector` outputs feed `memo(DashboardCharts)` — Recharts doesn't re-render for unrelated state (tested with `toBe` identity) |
| **Lazy loading + `Suspense` + code splitting + dynamic imports** | every page is `lazy: () => import(...)` (`routes.tsx`); Lab demos lazy inside `LabPage.tsx`; `AppLayout` wraps `<Outlet/>` in `<Suspense>` (doc 23) |
| **Virtualised lists** | `components/common/VirtualList.tsx` — 5 000 rows ⇒ < 20 DOM nodes (test); used for the **leave-balance report** (employees × types) and the Lab |
| **Efficient list rendering / stable keys** | ids as keys everywhere (`getRowId`, `key={c.id}`); field arrays use `field.id`; Lab proves index keys misplace input state after a reorder |
| **Large org chart** | `OrgTreeNode` renders children **only when expanded** — cost ∝ visible nodes, not company size; `memo` + stable callbacks limit work to the toggled branch |
| **Attendance records / reports** | server-side pagination (≤ 100/page) + `DataTable` memo rows; report search is client-side `useMemo` |
| **Dashboard charts** | `memo` + memoised series; Recharts and its 114 kB gzip live in a `charts` chunk loaded only on the dashboard route |
| **Avoiding avoidable network** | RTK Query de-dup/cache; `skip` for roles that don't use a filter; avatar Blob cache + `hasPicture` so no 404 requests (found by the route-sweep E2E) |
| **Bundle optimisation** | `vite.config.ts` `manualChunks` → `react`, `mui`, `charts`, `state`; 78 JS chunks; no sourcemaps in prod |

**Measured production build** (`npm run build`): initial entry `index` 378 kB (122 kB gzip) + `react` 109 kB (36.5 gzip) + `mui` 398 kB
(117.6 gzip) + `state` 39 kB (14.9 gzip) + `common` 54 kB (12.6 gzip) ≈ **304 kB gzip** for first paint; `charts` 422 kB (113.7 gzip) is
**not** in the initial load; largest page chunk is the employee form at 17.5 kB (6 kB gzip).

## 4. Relevant file paths
`src/components/tables/DataTable.tsx`, `src/components/common/VirtualList.tsx`, `src/features/organization/OrgTree.tsx`, `src/features/employees/EmployeeListPage.tsx`,
`src/features/dashboard/DashboardCharts.tsx`, `src/store/selectors/*.ts`, `src/features/lab/RenderingDemo.tsx`, `vite.config.ts`, `src/app/router/routes.tsx`.

## 5. Practical implementation — memo only works if props are stable
```tsx
// EmployeeListPage.tsx
const onToggle = useCallback((id: number) => { dispatch(toggleSelected(id)); }, [dispatch]);   // stable identity
<DataTable<Employee> … onToggleRow={onToggle} selectedIds={selectedIds} />                      // rows are memo()'d
```
Lab proof (`RenderingDemo.tsx`, asserted in `lab.test.tsx`): the "stable" row keeps its render count when the parent re-renders; the "inline
callback" row re-renders every time because its prop is a new function each render. And the keys demo: typing in row *Ann*, then reversing the
list, the **stable-key** list keeps the text with Ann; the **index-key** list leaves it in position 0 (now Cy's slot).

## 6. Why the concept is used
HR screens hold long lists and charts. Rendering less (virtualising, collapsing, lazy-loading) and rendering later (transitions,
debounce) delivers responsiveness that no amount of micro-memoisation could.

## 7. Advantages and limitations
**+** fast first paint, smooth typing, bounded DOM size. **−** `memo`/`useMemo`/`useCallback` add complexity and can *hurt* when props change every render or the work is cheap; virtualisation needs fixed/estimated row heights and breaks Ctrl-F/accessibility unless handled (`role="list"` used); lazy routes add a network hop on first visit; `manualChunks` needs periodic review (don't force rarely-shared code into one chunk). Profile with React DevTools Profiler / Lighthouse before optimising.

## 8. Interview-related considerations
* Explain the virtual DOM, diffing heuristics (same type, keys) and why index keys are dangerous.
* When does a component re-render? (state/props/context/parent.) How does `memo` compare props (shallow `Object.is`)?
* `useMemo` vs `useCallback` vs `memo`; "premature optimisation"; how to find the cause of a slow render (Profiler, `why-did-you-render`, flamegraph).
* Concurrent rendering: what do `useTransition`/`useDeferredValue` change? (interruptible, low-priority renders.)
* Virtualisation, code splitting, bundle analysis, image/asset strategies; what does StrictMode double-render tell you?
