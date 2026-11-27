# 23 · Suspense, lazy loading and code splitting

## 1. Concept explanation
* **Dynamic `import()`** tells the bundler to split the imported module into its own file (*chunk*) that's downloaded on demand.
* **`React.lazy(() => import('./Page'))`** wraps such an import as a component. When it first renders, React **suspends** until the chunk arrives.
* **`<Suspense fallback={…}>`** declares what to show *while* anything beneath it is suspended (a lazy component, or a data source that integrates with Suspense).
* **Router `lazy`** (React Router data router) does the same per *route* and also resolves before the route renders.

Together they give **code splitting**: the browser downloads only the code for the screen the user is on.

## 2. Syntax
```tsx
const Section = lazy(() => import('./LifecycleDemo'));                         // module-level, never inside a component!
<Suspense fallback={<Loading />}><Section /></Suspense>
{ path: 'employees', lazy: async () => ({ Component: (await import('@/features/employees/EmployeeListPage')).default }) }   // route-level
```

## 3. Actual EMS implementation
| Technique | Where |
|---|---|
| **Lazy-loaded routes** (every page) | `app/router/routes.tsx` → `lazyPage(() => import('…'))` — dashboard, employees (list/form/layout/tabs), departments, designations, organization, attendance, leave, holidays, reports, notifications, users, profile, settings, lab |
| Guest pages lazy too | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` as module-level `lazy()` wrapped in `<Suspense>` (`Guest` helper) |
| **`Suspense` boundaries** | `components/layout/AppLayout.tsx` (`<Suspense fallback={<Loading page/>}><Outlet/></Suspense>`), `features/lab/LabPage.tsx` (each demo is its own chunk) |
| **Dynamic imports** | every `import()` above; `LabPage` loads the six demo bundles only when their tab opens |
| **Bundle optimisation** | `vite.config.ts` `manualChunks` (`react`, `mui`, `charts`, `state`) + per-page chunks → 78 JS files; Recharts (114 kB gzip) loads only for the dashboard; no sourcemaps in production |
| `useTransition` with lazy content | `LabPage` switches tab inside `startTransition`, so the current tab stays visible (dimmed) while the next chunk loads instead of flashing a spinner |
| Fallback UX | `Loading` (spinner, `role="status"`) from `components/common/Feedback.tsx` |

Why `lazy()` is declared at **module level**: calling it inside a component creates a *new component type every render*, so React would
unmount/remount the page each time (state lost, flicker). A bug-prone mistake called out in a comment in `routes.tsx`.

## 4. Relevant file paths
`src/app/router/routes.tsx`, `src/components/layout/AppLayout.tsx`, `src/features/lab/LabPage.tsx`, `vite.config.ts`, `src/components/common/Feedback.tsx`.

## 5. Practical implementation
```tsx
// routes.tsx
const lazyPage = (importer: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await importer()).default });
{ index: true, lazy: lazyPage(() => import('@/features/employees/EmployeeListPage')) }
// AppLayout.tsx — one boundary around the Outlet covers all lazy children, and an ErrorBoundary handles a failed chunk download
<ErrorBoundary resetKeys={[pathname]}><Suspense fallback={<Loading page />}><Outlet /></Suspense></ErrorBoundary>
```
Observable result: `npm run build` emits one chunk per screen (e.g. `LeaveApplyPage` 3 kB, `ReportsPage` 9.7 kB, `EmployeeFormPage` 17.5 kB) and the entry
bundle contains none of them. The test suite renders the *real* route table, so lazy resolution + Suspense are exercised by every page test.

## 6. Why the concept is used
A 30-screen admin app would otherwise ship all screens, forms, charts and libraries on the login page. Splitting by route is the highest-leverage
bundle optimisation, and Suspense makes the loading state declarative.

## 7. Advantages and limitations
**+** much smaller first load, declarative fallbacks, composes with transitions and error boundaries. **−** a navigation to a not-yet-loaded route pays a network round-trip (mitigate with prefetch/hover preloading — not done here); a failed chunk download (deploy mismatch/offline) throws → needs an Error Boundary; `lazy` supports only *default* exports; Suspense for **data** requires a Suspense-aware data layer (RTK Query hooks are not Suspense-based here — they expose `isLoading`); SSR/streaming is out of scope for this SPA.

## 8. Interview-related considerations
* What does `React.lazy` need from the module (default export of a component) and why must it be called at module scope?
* Suspense fallback placement/granularity (one big spinner vs nested boundaries).
* How do you handle chunk-load errors? (Error Boundary + reload.) How do you preload a route?
* Route-level vs component-level splitting; `manualChunks` vs automatic splitting; how to analyse a bundle.
* Suspense with `startTransition` (keep old UI) and with data fetching in React 19 (`use`).
