# 23. Partial prerendering (PPR)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
PPR prerenders a route into a **static shell** and leaves *holes* (Suspense boundaries with runtime data) that stream in per request — static and dynamic in one response.

## 2. Syntax
```ts
// next.config.ts
const nextConfig: NextConfig = { cacheComponents: true, partialPrefetching: true };
```

## 3. How Next.js implements it
In Next.js 16 PPR is the model of `cacheComponents` (the old `experimental.ppr` flag is gone). `partialPrefetching` lets `<Link>` prefetch the static portion of dynamic routes. The build output marks such routes `◐ (Partial Prerender)`. **Experimental/opt-in:** both options are explicit config in 16.4.5.

## 4. Actual EMS implementation
Every authenticated route is `◐`: the sidebar skeleton, page title and layout are static; the session-dependent shell and tables stream in. `/register` is a static shell with cached registration options (`○ /register 5m 1y`). Verified in the `next build` route table.

## 5. Relevant file paths
- `next.config.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(auth)/register/page.tsx`
- `docs/nextjs-rendering-strategy.md`

## 6. Practical use case
Clicking *Employees* in the sidebar paints the page frame immediately (prefetched static part) and fills the table when the data arrives.

## 7. Why the concept is used
Gets the best of static speed and dynamic freshness without choosing per route.

## 8. Advantages
- Instant shell.
- No per-route strategy switches.

## 9. Limitations
- Requires Suspense discipline.
- Behaviour differs from Next 13/14 mental models.
- Status code of late `notFound()`.

## 10. Common mistakes
- Reading runtime data outside Suspense (build error).
- Believing PPR caches private data (it does not).

## 11. Interview-related considerations
- Explain PPR vs ISR.
- Why does `new Date()` break a static shell?
