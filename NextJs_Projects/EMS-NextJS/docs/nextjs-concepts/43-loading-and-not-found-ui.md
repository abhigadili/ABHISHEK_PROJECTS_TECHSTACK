# 43. Loading and not-found UI

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
`loading.tsx` creates an automatic Suspense fallback for a segment; `not-found.tsx` renders when `notFound()` is thrown or no route matches.

## 2. Syntax
```tsx
// loading.tsx
export default function Loading() { return <Skeleton … /> }
// not-found.tsx
export default function NotFound() { … }
```

## 3. How Next.js implements it
`loading.tsx` wraps the segment’s `page` and children in `<Suspense>` (instant, prefetchable fallback). `not-found.tsx` applies to the segment *and below*: a `notFound()` thrown by a **layout** is handled by a `not-found.tsx` placed **above** that layout.

## 4. Actual EMS implementation
* `app/loading.tsx` (generic spinner), `employees/[id]/loading.tsx` (tab skeleton), slot loaders `@kpis/loading.tsx`, `@charts/loading.tsx`; component-level skeletons (`Skeleton`) inside every page.
* `app/not-found.tsx` — global 404 (also rendered in the app shell for unknown authenticated URLs).
* `employees/not-found.tsx` — employee-specific "not found" with a back link. **Lesson learned the hard way:** it was first placed in `employees/[id]/`, but `loadEmployee()` runs in `[id]/layout.tsx`, and a `not-found.tsx` next to a layout cannot catch that layout’s `notFound()`; moving it up to `employees/` fixed it (verified by e2e test 5).
* `notFound()` is called by loaders for 404s and by pages for malformed ids.

## 5. Relevant file paths
- `src/app/loading.tsx`
- `src/app/not-found.tsx`
- `src/app/(dashboard)/employees/not-found.tsx`
- `src/app/(dashboard)/employees/[id]/loading.tsx`
- `src/app/(dashboard)/dashboard/@kpis/loading.tsx`
- `src/components/common/ui.tsx`

## 6. Practical use case
`/employees/999999` → friendly "Employee not found" with navigation instead of a generic 404.

## 7. Why the concept is used
Good UX while waiting and when things are missing.

## 8. Advantages
- Instant feedback.
- Contextual 404s.

## 9. Limitations
- Skeleton/layout mismatches cause shifts.
- Placement rules for `not-found.tsx` are subtle.

## 10. Common mistakes
- Putting `not-found.tsx` beside the layout that throws.
- One giant loading spinner for the whole app.

## 11. Interview-related considerations
- Where must `not-found.tsx` live to catch a layout’s `notFound()`?
