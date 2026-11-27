# 22 · `React.memo`, `useMemo` and `useCallback`

## 1. Concept explanation
All three are **render-skipping optimisations**, not features. Their power comes from *referential equality*: React compares
props/dependencies with `Object.is`, and `{} !== {}`, `() => {} !== () => {}` — so a value recreated each render looks "new" every time.

| Tool | Skips | Cache key |
|---|---|---|
| `React.memo(Component)` | re-rendering a **component** | shallow comparison of its props |
| `useMemo(fn, deps)` | re-running an **expensive calculation** (and keeps the *same object/array identity*) | `deps` |
| `useCallback(fn, deps)` | recreating a **function** so its identity is stable (`useMemo(() => fn, deps)` sugar) | `deps` |

They only pay off in combination: `memo` is defeated if any prop changes identity each render — `useMemo`/`useCallback` supply stable props.
They are **not** semantic guarantees (React may discard caches), so code must stay correct without them.

## 2. Syntax
```tsx
const Row = memo(function Row({ label, onPick }: { label: string; onPick: (l: string) => void }) { … });
const onPick = useCallback((l: string) => setPicked(l), []);              // stable
const fib = useMemo(() => slowFib(n), [n]);                               // recomputed only when n changes
```

## 3. Actual EMS implementation (each with its reason)
| Use | Why it is justified | File |
|---|---|---|
| `memo(DataRow)` | tables re-render on every selection/hover/sort state change; rows are many and identical in shape | `components/tables/DataTable.tsx` |
| `memo(EmployeeCard)`, `memo(ProfilePicture)` | list/grid of cards with primitive props; the picture hook would otherwise re-evaluate per parent render | `components/common/*.tsx` |
| `memo(OrgTreeNode)` | recursive tree; toggling one branch must not re-render siblings | `features/organization/OrgTree.tsx` |
| `memo(DashboardCharts)` + memoised selectors | Recharts is the most expensive subtree; props are `createSelector` outputs with stable identity | `features/dashboard/DashboardCharts.tsx` |
| `useCallback` for `onToggle`, `onOpen`, `onCardOpen` | give the memoised rows/cards **stable** handler props | `features/employees/EmployeeListPage.tsx` |
| `useCallback` for `login/logout/clearError/confirm/notify` | keep Context `value` stable → fewer consumer re-renders | `contexts/*.tsx`, `ConfirmDialog.tsx` |
| `useMemo` for Context values | a new `{…}` each render would re-render **every** consumer | `AuthenticationContext`, `UserContext`, `ThemeContext`, `AppConfigContext` |
| `useMemo(() => buildTheme(mode), [mode])` | rebuilding an MUI theme re-styles the app | `contexts/ThemeContext.tsx` |
| `useMemo` for DataTable `columns`, sidebar groups, report totals, search highlight `Set` | stable identity for children / avoid O(n) recompute on unrelated renders | `EmployeeListPage`, `Sidebar`, `AttendanceReportsPage`, `OrganizationPage` |
| `useMemo` for the fibonacci demo | an intentionally expensive calculation to *show* the effect | `features/lab/BasicHooksDemo.tsx` |

**Deliberately not memoised:** `PageHeader`, `StatusBadge` (cheap, rarely re-rendered with changing props), forms, page components. Adding
`memo` there would cost comparison time for no gain.

## 4. Relevant file paths
`src/components/tables/DataTable.tsx`, `src/features/organization/OrgTree.tsx`, `src/features/dashboard/DashboardCharts.tsx`,
`src/features/employees/EmployeeListPage.tsx`, `src/features/lab/BasicHooksDemo.tsx`, `src/features/lab/RenderingDemo.tsx`.

## 5. Practical implementation — the evidence
`BasicHooksDemo` renders a `memo`'d child that shows its own render count; clicking an **unrelated** state button leaves the count and the
memoised `fib(25)` untouched (asserted in `lab.test.tsx`: *"the memoised child does not re-render for unrelated state"*).
`RenderingDemo` puts two rows side by side:
```tsx
const stable = useCallback((l: string) => setPicked(l), []);
<Row label="stable" onPick={stable} />              // memo hit  → render count stays
<Row label="inline" onPick={(l) => setPicked(l)} /> // new function every render → memo defeated → count grows
```
Test: after "Re-render parent", `stable` text is unchanged and `inline` text changed. This is the single most common `memo` mistake, shown live.

## 6. Why the concept is used
To keep large tables, trees and charts from doing work when nothing relevant changed — responsive selection, expand/collapse and typing.

## 7. Advantages and limitations
**+** big wins on large/expensive subtrees; makes Context values and effect dependencies stable. **−** every `memo` costs a props comparison; stale-closure bugs when `deps` are wrong; clutter that hides logic; **React Compiler** (opt-in, not enabled here) can insert most of this automatically — then manual memoisation becomes unnecessary; custom `areEqual` is rarely worth it; objects/arrays/JSX created inline as props silently defeat `memo`.

## 8. Interview-related considerations
* When does `memo` not help? (unstable props, cheap component, children prop, Context consumers re-render regardless.)
* `useMemo` vs `useCallback`; why is `useCallback(fn, [])` with state inside a stale-closure risk? (use functional updates.)
* Does `useMemo` guarantee caching? (No.) Does `memo` stop Context re-renders? (No.)
* How do you decide what to memoise? (Profiler evidence; large lists, charts, Context values, effect deps.)
* What does the React Compiler change?
