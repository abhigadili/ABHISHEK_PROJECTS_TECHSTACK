# 02 · Components

## 1. Concept explanation
A React component is a **function that takes props and returns UI** (elements). Components are the unit of reuse and the unit of
re-rendering. This app is functional-components-only; the single class component (`ErrorBoundary`) exists because React still has
no Hook for error boundaries, and a second one (`LegacyCounter`) exists purely as a labelled learning example.

Vocabulary used in the codebase:
* **Presentational** components render from props and report events through callbacks (`StatusBadge`, `DashboardCard`, `EmployeeCard`, `DataTable`, `ConfirmDialog`).
* **Container** components fetch/derive data and hand plain props down (`DashboardPage`, `EmployeeListPage`, `OrganizationPage`).
* **Controlled** components get their value from React state (`SearchBox`, `FormTextField`); **uncontrolled** ones keep it in the DOM (`FileUpload`'s `<input type=file>`, the Lab's `UncontrolledForm`).
* **Composition**: parents pass JSX as `children` or props instead of configuring behaviour with flags (`Modal`, `AppLayout`, `PageHeader actions={…}`).

## 2. Syntax
```tsx
interface Props { title: string; subtitle?: string; actions?: ReactNode }       // required vs optional via TypeScript
export function PageHeader({ title, subtitle, actions }: Props) { return <Stack>…</Stack>; }  // destructured props
<PageHeader title="Employees" actions={<Button>New</Button>} />                  // props + JSX-as-prop
function Parent() { const [n, setN] = useState(0); return <Child n={n} onInc={() => setN(n + 1)} />; } // state lives in the parent
```

## 3. Actual EMS implementation
| Required reusable component | File |
|---|---|
| Header, Sidebar, Footer, Breadcrumbs | `components/layout/Header.tsx`, `Sidebar.tsx`, `Footer.tsx`, `Breadcrumbs.tsx` (composed by `AppLayout.tsx`) |
| Dashboard cards | `components/common/DashboardCard.tsx` |
| Data tables / Pagination / Search / Filters | `components/tables/DataTable.tsx` (generic `DataTable<T>`, sort + pagination), `SearchBox.tsx`, `FilterSelect.tsx` |
| Modal / Confirmation dialogs | `components/dialogs/Modal.tsx`, `ConfirmDialog.tsx` (presentational + `ConfirmProvider`/`useConfirm`) |
| Forms / Dropdowns | `components/forms/fields.tsx` (`FormTextField`, `FormSelect`, `FormCheckbox`), `ManagerSelect.tsx` |
| Employee cards / Profile pictures | `components/common/EmployeeCard.tsx`, `ProfilePicture.tsx` |
| Loading / Error / Empty | `components/common/Feedback.tsx` (`Loading`, `ErrorMessage`, `EmptyState`, `TableSkeleton`) |
| Notifications | `components/layout/NotificationMenu.tsx`, `components/dialogs/ToastHost.tsx` |
| Status badges | `components/common/StatusBadge.tsx` |
| File upload | `components/common/FileUpload.tsx` |

Parent/child and component extraction: `EmployeeFormPage.tsx` (container) → `form/FieldArraySections.tsx` (`EducationSection`, `ExperienceSection`, …).
Component organisation: shared UI in `components/`, everything feature-specific in `features/<feature>/` next to its page.

## 4. Relevant file paths
`src/components/**`, `src/features/**/**Page.tsx`, `src/features/employees/form/FieldArraySections.tsx`, `src/components/components.test.tsx`.

## 5. Practical implementation
`DataTable` is a *generic presentational* component: callers describe columns, the table owns layout concerns.
```tsx
<DataTable<Employee> columns={columns} rows={deferredItems} getRowId={(e) => e.id}
  loading={isFetching} error={isError ? errorMessage(error) : null} onRetry={refetch}
  onRowClick={onOpen} selectedIds={selectedIds} onToggleRow={onToggle}
  sort={{ field: sortField, dir }} onSort={onSort}
  pagination={{ page, limit, total, onPage, onLimit }} />
```
`DataTable` knows nothing about employees, departments or leave — six screens reuse it (employees, departments, designations, attendance, leave, users, reports).

## 6. Why the concept is used
Reuse (one table, one dialog, one badge), consistency (identical empty/loading/error behaviour everywhere) and testability
(`components/components.test.tsx` tests each in isolation without a backend).

## 7. Advantages and limitations
**+** Small units are easy to test and memoise; composition avoids prop explosion. **−** Over-generic components grow a long prop
list (`DataTable` has 15) — extract before it becomes a "god component"; splitting too early scatters logic. Don't create a
component per `<div>`; extract when you reuse, when state is local to the piece, or when a function gets hard to read.

## 8. Interview-related considerations
* Function vs class components; why Hooks replaced classes (logic reuse without HOCs/render-props, no `this`).
* Presentational vs container is a *convention* (Dan Abramov later softened it) — Hooks let one component do both cleanly.
* "Where should state live?" → lowest common ancestor of components that need it (see 03 and 04).
* Pure components: render must not mutate props/state or produce side effects (StrictMode double-invokes render to catch this).
* Component identity: defining a component *inside* another component remounts it every render — see why `lazy()` is called at module level in `app/router/routes.tsx`.
