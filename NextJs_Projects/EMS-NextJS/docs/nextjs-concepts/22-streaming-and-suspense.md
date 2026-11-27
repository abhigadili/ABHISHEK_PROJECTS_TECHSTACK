# 22. Streaming and Suspense

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Streaming sends HTML in chunks: the shell first, then each `<Suspense>` boundary as its data resolves. `loading.tsx` is shorthand for a Suspense boundary around a segment.

## 2. Syntax
```tsx
<Suspense fallback={<Skeleton className="h-64" />}><Body /></Suspense>
// app/…/loading.tsx  → automatic boundary for the segment
// app/…/@charts/error.tsx → error boundary for one slot
```

## 3. How Next.js implements it
React 19 Suspense + Next.js streaming SSR: the response stays open while boundaries resolve; fallbacks are part of the static shell. Errors inside a boundary are caught by the nearest `error.tsx`. Avoid waterfalls: start independent fetches together.

## 4. Actual EMS implementation
* Every page: static header + `<Suspense fallback={<Skeleton/>}>` around the async body.
* `(dashboard)/layout.tsx`: `<Suspense fallback={<ShellSkeleton/>}>` around the whole authenticated shell (session read).
* Route-level `app/loading.tsx` and `employees/[id]/loading.tsx`; slot-level `@kpis/loading.tsx`, `@charts/loading.tsx` (+ `error.tsx`).
* `employees/[id]/layout.tsx`: the header streams (`<Skeleton/>` fallback) while the child tab streams on its own.
* `Promise.all` in layouts/pages (e.g. `loadEmployee` + `requireSession`, departments + designations) avoids request waterfalls.

## 5. Relevant file paths
- `src/app/loading.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/dashboard/@kpis/loading.tsx`
- `src/app/(dashboard)/employees/[id]/loading.tsx`
- `src/app/(dashboard)/employees/[id]/layout.tsx`

## 6. Practical use case
Users see the navigation and page title instantly while the table loads behind a skeleton.

## 7. Why the concept is used
Perceived performance: the slowest part never blocks the rest.

## 8. Advantages
- Fast first paint.
- Isolated failures/loading states.

## 9. Limitations
- Skeleton design effort.
- Layout shift if skeletons don’t match content.
- Status codes are committed before late errors (see `notFound()` caveat).

## 10. Common mistakes
- One giant Suspense around the page (no benefit).
- Sequential awaits (waterfalls).

## 11. Interview-related considerations
- How does streaming relate to SEO?
- What is a waterfall?
