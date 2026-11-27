# 24 · Error boundaries (and how they differ from API error handling)

## 1. Concept explanation
An **Error Boundary** is a component that catches JavaScript errors thrown **while React is rendering its subtree** (render functions,
lifecycle methods, constructors of descendants), shows a **fallback UI** instead of letting the whole app unmount, and lets the user
**recover**. Only *class* components can be boundaries (`static getDerivedStateFromError` + `componentDidCatch`) — React has no Hook for
this, so `ErrorBoundary` is the one deliberate class component in the application.

### Error boundaries vs normal asynchronous/API error handling
| | Error Boundary | API / async error handling |
|---|---|---|
| Catches | exceptions thrown **during rendering** (bugs: `undefined.x`, bad data shape) | failed **requests**, rejected promises, validation/business errors |
| Does **not** catch | event-handler errors, `setTimeout`/Promise rejections, SSR, errors in the boundary itself | — |
| Where handled here | `components/common/ErrorBoundary.tsx`, router `errorElement` | RTK Query `isError`/`error` → `ErrorMessage` + Retry; thunks `rejectWithValue`; `try/catch` in handlers; Axios interceptor (toasts for 403/5xx, field errors for 400/409/422) |
| UI | "This part of the page crashed" + *Try again* | inline message / toast / field error |
Rule: expected failures (network, 404, validation) are **data** and handled where they occur; unexpected programmer errors reach the boundary.

## 2. Syntax
```tsx
class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }         // switch to fallback UI
  componentDidCatch(error: Error, info: ErrorInfo) { log(error, info.componentStack); }   // side effect: logging
  render() { return this.state.error ? <Fallback/> : this.props.children; }
}
```

## 3. Actual EMS implementation
| Required item | Where |
|---|---|
| Reusable Error Boundary component | `components/common/ErrorBoundary.tsx` — props: `fallback(error, reset)`, `resetKeys`, `onError` |
| **Fallback UI** | default `<Alert role="alert">` with the message and **Try again**; custom fallbacks supported (`RenderingDemo`) |
| **Error recovery** | `reset()` clears state; **`resetKeys`** auto-recovers when a value changes — `AppLayout` passes `[pathname]`, so navigating to another page clears a crash on the previous one |
| **Logging** | `componentDidCatch` → `console.error` with the component stack + `onError` hook (where Sentry/Datadog would plug in) |
| **Route-level error handling** | `errorElement: <RouteError/>` on the root layout and on `employees/:id` (`features/auth/StatusPages.tsx`): renders `Response` errors, API errors (404 "Not found", 403 "Access denied"), and render exceptions with **Go back / Dashboard** actions |
| **Unexpected rendering failures** | `AppLayout` wraps every page in an `ErrorBoundary`; the shell (header/sidebar) survives a crashing page |
| Class component justification | documented in the file header; the *only* production class component |
| Lab | `features/lab/RenderingDemo.tsx` — "Throw during render" → fallback → "Recover" |

Tests (`components/components.test.tsx`, 6 tests): renders children; **catches** a render error and calls `onError` with `componentStack`;
recovers via *Try again*; **auto-resets** when a `resetKey` changes; supports a custom fallback; and — importantly — **does not catch
an error thrown in an event handler** (asserted), proving the distinction in section 1. `pages.test.tsx` covers the route `errorElement`
(`/employees/999` → "Employee not found").

## 4. Relevant file paths
`src/components/common/ErrorBoundary.tsx`, `src/components/layout/AppLayout.tsx`, `src/features/auth/StatusPages.tsx`,
`src/app/router/routes.tsx`, `src/features/lab/RenderingDemo.tsx`, `src/components/components.test.tsx`.

## 5. Practical implementation
```tsx
// AppLayout.tsx
const { pathname } = useLocation();
<ErrorBoundary resetKeys={[pathname]}>        // crash on /reports → click "Employees" → boundary resets automatically
  <Suspense fallback={<Loading page />}><Outlet /></Suspense>
</ErrorBoundary>
```
```tsx
// ErrorBoundary.tsx — recover when the reset keys changed since the last update
componentDidUpdate(prev: Props) {
  if (this.state.error && prev.resetKeys && this.props.resetKeys && prev.resetKeys.some((k, i) => !Object.is(k, this.props.resetKeys![i]))) this.reset();
}
```
Network failures never reach it: a failed `/employees` call shows the table's `ErrorMessage` with **Retry** while the rest of the page stays usable.

## 6. Why the concept is used
Without a boundary, one thrown render error blanks the whole SPA. With boundaries (global + per-route) users keep navigation and can
retry; developers get structured logs.

## 7. Advantages and limitations
**+** contains blast radius, supports recovery, central logging point. **−** class-only API; doesn't catch handlers/async errors (so you still need try/catch and query error states); a boundary can't catch its *own* render error (nest them); in development React re-throws to the overlay; recovery re-renders the same data — if the bad data persists the error repeats (hence `resetKeys`).

## 8. Interview-related considerations
* What do Error Boundaries catch and *not* catch? Why can't a function component be a boundary?
* `getDerivedStateFromError` vs `componentDidCatch` (render-phase state vs commit-phase side effects).
* Where to place boundaries (global, route, widget) and how to reset them. How would you report errors in production?
* Error Boundary vs `try/catch` vs RTK Query error state vs `errorElement` in a data router.
* What happens to unmounted state when a boundary trips? (The subtree is unmounted.)
