# 03 · Props and component communication

## 1. Concept explanation
Data flows **down** as props; events flow **up** as callback props. Siblings talk through their nearest common parent ("lifting
state up"). `children` is just a prop that holds JSX. Props are read-only — a child never mutates what it receives.

## 2. Syntax
```tsx
// parent → child (data) and child → parent (callback)
<EmployeeCard employee={e} selected={isSel} onSelect={handleSelect} />
// destructuring + defaults + optional + required (TypeScript)
function Panel({ title, tone = 'neutral', children }: { title: string; tone?: 'neutral' | 'good'; children?: ReactNode }) {}
// spread props: forward everything else onto a DOM element
<Box {...rest}>…</Box>
// generic reusable component: T is inferred from `rows`
function DataTable<T>(props: { rows: T[]; getRowId: (r: T) => string | number /* … */ }) {}
```

## 3. Actual EMS implementation
| Technique | Where |
|---|---|
| Parent → child props | `DashboardPage` → `DashboardCharts headcount={…} attendance={…} leave={…}` (`features/dashboard/`) |
| **Callback props** (employee selection) | `EmployeeListPage` passes a stable `onCardOpen`/`onToggle` into `EmployeeCard`/`DataTable`; the card calls `onSelect(employee.id)` (`components/common/EmployeeCard.tsx`) |
| **Siblings through a common parent** (department filter) | `FilterSelect` (department) and `DataTable` (rows) are siblings in `EmployeeListPage`; the parent owns the filter, the select reports changes, the table receives results. Across *screens* the filter lives in Redux (`store/slices/departmentSlice.ts`). Plain demo: `features/lab/PatternsDemo.tsx` (`Sibling` A/B share one lifted value) |
| `children` | `Modal` (`components/dialogs/Modal.tsx`), `Can`, `ErrorBoundary`, `AppLayout` |
| Default values | `EmployeeCard selected = false`, `Modal maxWidth = 'sm'`, `StatusBadge size = 'small'`, `Loading label = 'Loading…'` |
| Optional props | `PageHeader subtitle?` / `actions?`, `ConfirmOptions confirmLabel?` |
| Required through TypeScript | omitting `title` on `PageHeader` or `rows` on `DataTable` is a compile error |
| Props destructuring | every component signature |
| **Spread props** | `components/forms/fields.tsx` (`<TextField {...field} />` from RHF), `PatternsDemo.tsx` (`{...spread}` of `aria-label`/`data-*`) |
| Composition | `PageHeader actions={<Can permission="employee:manage"><Button/></Can>}` — a permission-gated button passed as a prop |
| Reusable generic components | `DataTable<T>`, `List<T>` (`features/lab/patterns/RenderProp.tsx`), `useApi<T, A>` hook, `useLocalStorage<T>` |
| Confirmation dialog reuse | `ConfirmProvider`/`useConfirm()` — one dialog serves departments, employees, leave cancel, users, holidays |

## 4. Relevant file paths
`src/components/common/EmployeeCard.tsx`, `src/components/tables/DataTable.tsx`, `src/components/dialogs/ConfirmDialog.tsx`,
`src/features/employees/EmployeeListPage.tsx`, `src/features/lab/PatternsDemo.tsx`.

## 5. Practical implementation
Stable callbacks make `memo` effective — the whole reason `EmployeeListPage` uses `useCallback`:
```tsx
const onToggle = useCallback((id: number) => { dispatch(toggleSelected(id)); }, [dispatch]);   // same identity every render
<DataTable<Employee> … onToggleRow={onToggle} selectedIds={selectedIds} />                         // row is memo()'d on these props
```
and the typed confirm dialog is a *promise*, so call sites read linearly:
```tsx
if (!(await confirm({ title: 'Deactivate employee?', destructive: true, message: '…' }))) return;
```

## 6. Why the concept is used
One-way data flow makes UI predictable: to know why a row is highlighted, look at the props above it. Callbacks keep children
ignorant of *how* the parent stores things (Redux, URL, local state), so the same card works in a list, a department page and a search result.

## 7. Advantages and limitations
**+** Explicit contracts, easy testing (`EmployeeCard` test passes a `vi.fn()` and asserts it is called with `4`). **−** **Prop drilling**: passing a value through many layers is noisy — the cure is Context (`UserContext`, `useOutletContext` in `EmployeeLayout`) or Redux, not more props. Avoid boolean-flag explosions (`isSmall isRounded isGhost`); prefer composition or a variant string.

## 8. Interview-related considerations
* Props vs state (props are inputs owned by a parent; state is memory owned by the component).
* Why can't a child modify props? Immutability → predictable renders; use a callback.
* `children` vs render props vs slots (named props like `actions`).
* How would you avoid prop drilling? Context, composition (pass the *element*), or a store.
* TypeScript: `ReactNode` vs `ReactElement`; `ComponentProps<typeof X>`; generics on components; why `React.FC` is not needed.
