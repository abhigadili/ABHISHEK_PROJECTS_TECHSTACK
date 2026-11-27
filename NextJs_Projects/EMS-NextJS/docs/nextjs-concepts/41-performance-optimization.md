# 41. Performance optimisation

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Performance in Next.js is mostly about *sending less JavaScript*, *rendering what matters first* and *not repeating work*. Core Web Vitals (LCP, CLS, INP) are the user-facing measures.

## 2. Syntax
```tsx
const DashboardCharts = dynamic(() => import('./DashboardCharts'), { ssr: false, loading: () => <Skeleton/> });  // code splitting
const Row = memo(function Row(…) { … });                                                                         // avoid re-renders
const [a, b] = await Promise.all([getDepartments(), getDesignations()]);                                         // no waterfalls
```

## 3. How Next.js implements it
Automatic route-based code splitting, Server Components (no client JS), streaming, prefetching, `next/image`, `next/font`, caching layers, and the React Compiler-friendly lint rules (`react-hooks/*`) that this project satisfies.

## 4. Actual EMS implementation
Applied techniques (each is in the code, none is merely documented):

| Technique | Where |
|---|---|
| Server Components by default (zero JS for tables, lists, details) | all `app/**/page.tsx`, `DataTable`, `Pagination` |
| Dynamic import of the heaviest dependency (Recharts, `ssr:false`) | `features/dashboard/ChartsLazy.tsx` |
| Streaming + Suspense, PPR static shell, `partialPrefetching` | doc 22/23, `next.config.ts` |
| Parallel fetching (`Promise.all`) / request memoisation (`React.cache`) | `employees/[id]/layout.tsx`, `session.ts`, `dashboard.ts` |
| Data Cache for reference data, `'use cache'` for public help | docs 28–32 |
| `React.memo` for tree nodes; `useMemo` for the filtered org tree; stable callbacks | `OrgTree.tsx` |
| Debounced search (350 ms) + `startTransition` to keep typing responsive | `EmployeeFilters.tsx` |
| Cancellable requests (`AbortController`) in typeahead and username check | `hooks/useEmployees.ts`, `AuthForms.tsx` |
| Image: `priority` LCP hero, explicit width/height, lazy avatars; `sizes` | doc 38 |
| Fonts self-hosted at build, `display: swap` | doc 39 |
| Polling only while the tab is visible | `hooks/useNotifications.ts` |
| Pagination everywhere (limits 10–15) instead of loading whole lists | list pages |
| Fine-grained form subscriptions (`useWatch`) | `EmployeeForm.tsx` |
| Reduced animation work: a single CSS fade in `template.tsx` | `template.tsx` |

`useDeferredValue` keeps the org-chart search box responsive while a large tree is re-filtered (`hooks/useOrganization.ts`). *Demonstrated in isolation* (not needed in production screens): `useOptimistic`, `useLayoutEffect` — `/learn/hooks`. The manager / department-head pickers search on demand (`EmployeePicker`) instead of preloading 100 employees into a `<select>`.

## 5. Relevant file paths
- `src/features/dashboard/ChartsLazy.tsx`
- `src/features/departments/OrgTree.tsx`
- `src/features/employees/EmployeeFilters.tsx`
- `src/hooks/useNotifications.ts`
- `src/app/(dashboard)/employees/[id]/layout.tsx`
- `next.config.ts`

## 6. Practical use case
The dashboard shows KPI cards immediately; the 100 kB+ charting library downloads only when the chart island hydrates.

## 7. Why the concept is used
Faster first paint, lower data/CPU use, better INP.

## 8. Advantages
- Less JS shipped.
- Fast perceived loads.
- Measurable choices.

## 9. Limitations
- Streaming has a cost: skeletons must match content to avoid layout shift.
- Premature memoisation adds complexity (used only where re-renders were real: tree nodes).

## 10. Common mistakes
- Making whole pages client components.
- Sequential awaits.
- Importing a charting library into a Server Component tree without lazy loading.
- Unbounded lists.

## 11. Interview-related considerations
- How do you find what to optimise? (Lighthouse, Web Vitals, `@next/bundle-analyzer`, React Profiler)
- Why `memo` only on some components?
