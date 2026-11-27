# 27 · Render props and compound components

## 1. Concept explanation
**Render props**: a component receives a *function prop* that returns JSX and calls it with its internal state/behaviour. The component
owns **behaviour**; the caller owns **presentation**. (`children` as a function is the same idea.)

**Compound components**: a set of components designed to work **together**, sharing implicit state through a private Context —
`<Tabs>`, `<Tabs.List>`, `<Tabs.Tab>`, `<Tabs.Panel>` (like `<select>`/`<option>` in HTML). The consumer composes the structure freely;
the parts stay in sync without prop-threading.

Both predate Hooks as ways to share logic/structure. Today custom Hooks cover most render-prop cases; compound components remain the best
API for **UI widgets with several cooperating parts**.

## 2. Syntax
```tsx
// render prop
<MouseTracker render={({ x, y }) => <span>pointer at {x},{y}</span>} />
function MouseTracker({ render }: { render: (pos: Pos) => ReactNode }) { const [pos, setPos] = useState(…); return <div onMouseMove={…}>{render(pos)}</div>; }

// compound
<Tabs defaultValue="one"><Tabs.List><Tabs.Tab value="one">One</Tabs.Tab></Tabs.List><Tabs.Panel value="one">…</Tabs.Panel></Tabs>
const TabsContext = createContext<Ctx | null>(null);   Tabs.Tab = function Tab({ value }) { const { active, setActive } = useTabs(); … }
```

## 3. Actual EMS implementation
| Pattern | Where | Real or learning? |
|---|---|---|
| **Render prop** — `MouseTracker` (`render={...}`) and generic `List<T>` (`renderItem`) | `features/lab/patterns/RenderProp.tsx`, demo `PatternsDemo.tsx` | Lab learning example |
| **Render-prop-style APIs used in production** | `Controller`'s `render={({ field, fieldState }) => …}` in `components/forms/fields.tsx` (`FormSelect`, `FormCheckbox`); `ErrorBoundary`'s `fallback={(error, reset) => …}` (`ErrorBoundary.tsx`, used in `RenderingDemo`); `DataTable` column `render: (row) => …` (every table) | **production use** |
| **Compound components** — `Tabs` / `Tabs.List` / `Tabs.Tab` / `Tabs.Panel` with shared Context, ARIA roles (`tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`), `useId` for unique ids, and a guard that throws outside `<Tabs>` | `features/lab/patterns/CompoundTabs.tsx` | Lab learning example |
| **Compound-style composition in production** | MUI (`Card` + `CardContent`, `Dialog` + `DialogTitle/Content/Actions`, `List` + `ListItemButton`) as used by `Modal`, `ConfirmDialog`, `NotificationMenu`; `EmployeeLayout` + `<Outlet context>` + child routes share state implicitly through the router | production use |
| Generic components with render callbacks | `DataTable<T>` (`columns[].render`), `List<T>` | production / Lab |

## 4. Relevant file paths
`src/features/lab/patterns/RenderProp.tsx`, `src/features/lab/patterns/CompoundTabs.tsx`, `src/features/lab/PatternsDemo.tsx`,
`src/components/forms/fields.tsx`, `src/components/tables/DataTable.tsx`, `src/features/lab/lab.test.tsx`.

## 5. Practical implementation
`DataTable` is a real-world render-prop consumer: *what to show in a cell* is the caller's decision, *how a table behaves* is the component's:
```tsx
{ key: 'status', header: 'Status', sortKey: 'status', render: (e) => <StatusBadge status={e.status} /> }
```
Tests (`lab.test.tsx`): the render prop receives updated state (`fireEvent.mouseMove` with `clientX: 15, clientY: 7` → "15,7"); compound `Tabs`
expose `aria-selected`, show only the active panel, switch on click, and **throw a helpful error** when `Tabs.Tab` is used outside `<Tabs>`.

## 6. Why the concept is used
Render props decouple *behaviour* from *markup*; compound components give widget authors a declarative, flexible API (no `tabs=[{label, content}]` prop).
They are asked about constantly in interviews and appear throughout component libraries, so the Lab keeps minimal, tested versions.

## 7. Advantages and limitations
**Render props** — **+** very flexible, explicit data flow; **−** "callback hell" when nested, new function identity every render (defeats `memo`), mostly superseded by Hooks.
**Compound components** — **+** expressive API, shared state without prop drilling, good for accessibility wiring; **−** children must be rendered inside the parent (cloning/Context coupling), static-member typing (`Tabs.Tab`) is slightly awkward, hidden Context dependency makes isolated testing harder, and wrapping children in extra elements can break `React.Children`-based implementations (the Context approach avoids that).

## 8. Interview-related considerations
* Render prop vs HOC vs custom Hook — which would you choose today and why?
* How do compound components share state? (Context, or `React.Children.map` + `cloneElement` — and why Context is more robust.)
* Controlled vs uncontrolled compound components (`value`/`onValueChange` vs `defaultValue`).
* How does the "function as a child" pattern work and what's its performance gotcha?
* Real-world examples: Reach UI / Radix primitives, `<Formik>`, `<Controller render>`, MUI `Autocomplete renderInput`.
