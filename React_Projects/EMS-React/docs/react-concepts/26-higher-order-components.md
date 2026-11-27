# 26 · Higher-Order Components (HOCs)

## 1. Concept explanation
A **Higher-Order Component** is a *function that takes a component and returns a new component* with added behaviour:
`const Enhanced = withSomething(Base)`. It is the pre-Hooks way to share logic across components (cross-cutting concerns: auth gating,
loading states, data injection, theming). React itself ships HOC-shaped helpers: `memo(Component)`, `forwardRef(Component)`, and
`lazy`. Libraries use them heavily (`connect` in classic react-redux, MUI's `styled`, React Router's old `withRouter`).

Today **custom Hooks and composition are preferred** for new code because HOCs have well-known downsides (see §7). They remain essential to
*read* in legacy code and in interviews.

## 2. Syntax
```tsx
function withLoading<P extends object>(Wrapped: ComponentType<P>) {
  function WithLoading({ loading, ...props }: P & { loading: boolean }) {
    return loading ? <Loading /> : <Wrapped {...(props as unknown as P)} />;   // forward every other prop untouched
  }
  WithLoading.displayName = `withLoading(${Wrapped.displayName ?? Wrapped.name ?? 'Component'})`;   // readable DevTools name
  return WithLoading;
}
const NamesWithLoading = withLoading(Names);   // <NamesWithLoading loading names={['Alice']} />
```
Conventions: don't mutate the wrapped component; pass through unrelated props; set `displayName`; hoist statics (`hoist-non-react-statics`) if needed; **create the enhanced component once, outside render**.

## 3. Actual EMS implementation
| Item | Where | Status |
|---|---|---|
| `withLoading` HOC (typed with generics, `displayName`, prop forwarding) | `features/lab/patterns/withLoading.tsx`, demo in `features/lab/PatternsDemo.tsx` | **Learning example in the React Lab** — clearly labelled; EMS business screens don't need a HOC |
| Built-in HOC-style APIs used for real | `memo(...)` (`DataTable` rows, `EmployeeCard`, `ProfilePicture`, `OrgTreeNode`, `DashboardCharts`), `forwardRef(...)` (`FileUpload`), `lazy(...)` (routes, Lab) | production use |
| The same job done without a HOC | `ProtectedRoute` / `Can` (**composition**) and `usePermissions` (**Hook**) instead of `withPermission(Component, roles)`; `useApi`/RTK Query loading flags instead of `withLoading` | see docs 09 and 15 |

Honesty note: because the application deliberately avoids HOCs, the HOC implementation lives in the Lab only. It is nevertheless executed
by unit tests (`features/lab/lab.test.tsx`).

## 4. Relevant file paths
`src/features/lab/patterns/withLoading.tsx`, `src/features/lab/PatternsDemo.tsx`, `src/features/lab/lab.test.tsx`.

## 5. Practical implementation
How the same permission rule looks as a HOC vs what EMS actually does:
```tsx
// HOC version (not used)
const EmployeeAdminPage = withPermission('employee:manage')(EmployeePage);
// EMS version: composition at the route, and a Hook inside components
{ path: 'new', element: <ProtectedRoute permission="employee:manage" />, children: [...] }
const { can } = usePermissions();   {can('employee:manage') && <Button/>}
```
Unit test for the HOC: `loading` → spinner and the inner component isn't rendered; `loading={false}` → the inner component receives its props;
`Wrapped.displayName === 'withLoading(Inner)'`.

## 6. Why the concept is used
To understand and maintain codebases that predate Hooks, to read library code, and to know *when a HOC is still the right tool* (wrapping
class components, injecting props into many unrelated components, library APIs like `memo`/`forwardRef`).

## 7. Advantages and limitations
**+** reuse of cross-cutting logic without touching the component; works with class components; composable (`compose(withA, withB)`).
**−** **wrapper hell** in DevTools; **prop collisions** (two HOCs injecting the same prop name); **static hoisting** and **ref forwarding** are
easy to forget (refs don't pass through a HOC without `forwardRef`); typing is awkward (generics + `Omit` for injected props); creating a HOC
*inside* render remounts the subtree every render; implicit data flow (where did this prop come from?). Hooks solve nearly all of these.

## 8. Interview-related considerations
* Define a HOC; give three real examples (`connect`, `withRouter`, `memo`). How is it different from a render prop or a custom Hook?
* Why shouldn't you apply a HOC inside `render`? How do you preserve `displayName`, refs and statics?
* Pros/cons vs Hooks; when would you still choose a HOC?
* How do you type a HOC that *injects* props (`Omit<P, keyof Injected>`)?
