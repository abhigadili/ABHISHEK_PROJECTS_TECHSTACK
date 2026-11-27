# 01 · JSX and TSX

## 1. Concept explanation
**JSX** is a syntax extension that lets you write markup-like trees inside JavaScript. It is not HTML and not a string: the build
tool (Vite + esbuild/`@vitejs/plugin-react`) compiles `<Button size="small">Save</Button>` into a function call
(`jsx(Button, { size: "small", children: "Save" })`) that returns a plain object describing the UI (a *React element*).
**TSX** is JSX in a `.tsx` TypeScript file, so props, event objects and children are type-checked.

Key rules: one root (or a Fragment); `className` instead of `class`; `{ }` embeds any JavaScript **expression** (not statements);
attributes are camelCase; `{}` in an attribute passes a value, not a string; text is escaped by default (XSS-safe).

## 2. Syntax
```tsx
const el = <p className={ok ? 'good' : 'bad'} onClick={() => save(id)}>{count} items</p>; // expression, dynamic attr, handler
{cond && <Spinner />}                 // conditional (short-circuit)   {cond ? <A/> : <B/>}   // ternary
{rows.map((r) => <Row key={r.id} {...r} />)}   // list + key + spread props
<>…</>                                // Fragment shorthand;  <Fragment key={k}>…</Fragment> when a key is needed
const Tag = isLink ? 'a' : 'button';  <Tag />   // choosing the element/component dynamically
<div style={{ opacity: loading ? 0.6 : 1 }} />  // inline style = object, camelCase keys
```

## 3. Actual EMS implementation
| Feature | Where |
|---|---|
| Embedded expressions & conditional rendering | `features/dashboard/DashboardPage.tsx` — KPI cards, `status === 'forbidden'` early return, `{events.birthdays.length === 0 ? … : …}` |
| List rendering with stable keys | `features/organization/OrgTree.tsx` (`key={c.id}`), `components/tables/DataTable.tsx` (`key={getRowId(row)}`) |
| Dynamic attributes / `aria-*` | `OrgTree.tsx` (`aria-current`, `aria-expanded`), `components/layout/NotificationMenu.tsx` (`aria-label={`Notifications (${unread} unread)`}`) |
| Fragments | `features/employees/EmployeeListPage.tsx`, `features/departments/DepartmentDetailPage.tsx` (`<> … </>`), `components/layout/Sidebar.tsx` (`<Fragment key={section}>`) |
| Event handling | `features/leaves/LeavePage.tsx` (`onClick` with `e.stopPropagation()`), `components/tables/SearchBox.tsx` (`onChange`) |
| Inline styles | `features/lab/patterns/RenderProp.tsx`, `features/lab/patterns/CompoundTabs.tsx`, `features/lab/RenderingDemo.tsx` (portal tooltip positioning) |
| Dynamic class names | `features/attendance/AttendanceCalendarPage.tsx` → `classNames('cal-cell', off && 'off', …)` using `utils/format.ts#classNames` |
| Rendering components dynamically | `features/lab/LabPage.tsx` (`const Section = SECTIONS[tab]; <Section />`), `components/common/StatusBadge.tsx` (colour looked up by status) |
| `.tsx` vs `.ts` | Components are `.tsx`; services, hooks, slices, schemas, utils are `.ts`. |

## 4. Relevant file paths
`src/main.tsx`, `src/App.tsx`, `src/features/**/*.tsx`, `src/components/**/*.tsx`, `src/features/lab/*.tsx`.

## 5. Practical implementation
`StatusBadge` shows three JSX ideas in 8 lines — a lookup table, a dynamic prop, and a computed variant:
```tsx
const COLORS: Record<string, ChipProps['color']> = { ACTIVE: 'success', PENDING: 'warning', REJECTED: 'error' /* … */ };
export function StatusBadge({ status, label, size = 'small' }: { status: string; label?: string; size?: ChipProps['size'] }) {
  return <Chip size={size} label={label ?? humanize(status)} color={COLORS[status] ?? 'default'}
               variant={!COLORS[status] || COLORS[status] === 'default' ? 'outlined' : 'filled'} />;
}
```
Used in `<StatusBadge status={e.status} />` (employees), `status={r.status}` (leave, attendance) — one component, one colour language.

## 6. Why the concept is used
Markup and the logic that drives it (filtering, permissions, loading flags) live together, so a screen is read top-to-bottom as
"given this state, this is what the user sees". TSX adds compile-time safety: a misspelt prop or a missing `key` type error is
caught before the browser.

## 7. Advantages and limitations
**+** Declarative; full JavaScript in templates; refactor-safe with TypeScript; escaping prevents most XSS.
**−** Deeply nested ternaries get unreadable (extract a component or early-return, as `DashboardPage` does); a JSX expression
can't contain statements (`if`, `for`); returning `0` from `{count && <X/>}` renders a literal `0` (use `count > 0 &&`).
Never use `dangerouslySetInnerHTML` with server data — this app uses none.

## 8. Interview-related considerations
* *Is JSX required?* No — it is sugar over `jsx()`/`createElement`. *Is it HTML?* No (`className`, `htmlFor`, self-closing tags required).
* *Why keys?* So reconciliation can match list items across renders (see `docs/react-concepts/21`). Index keys break on reorder — demo in the Lab (`RenderingDemo.tsx`, tested in `lab.test.tsx`).
* *`&&` vs ternary pitfalls*, *Fragment vs div* (no extra DOM node, matters for tables/flex/grid), *how does React escape text?* (children are text nodes, not parsed HTML).
* *What does the new JSX transform change?* No `import React` needed; `jsx-runtime` imported automatically (`"jsx": "react-jsx"` in `tsconfig.app.json`).
