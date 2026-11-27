# 28. Next.js caching overview

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Caching reduces repeated work. Next.js has several layers (request memoisation, Data Cache / `'use cache'`, Full Route Cache / static shell, Router Cache). In this version caching is **opt-in**: nothing is cached unless you say so.

## 2. Syntax
```ts
'use cache'; cacheLife({ revalidate: 3600 }); cacheTag('help');                // component/function cache
fetch(url, { next: { revalidate: 300, tags: ['departments'] } });             // Data Cache
const get = cache(async (id: number) => …);                                    // request memoisation
```

## 3. How Next.js implements it
See docs 29–32 for each layer. Rule: **runtime data (cookies/headers/params/searchParams) cannot be read inside a `'use cache'` scope** — pass it in as an argument, or don’t cache.

## 4. Actual EMS implementation
Full catalogue, lifetimes, tags and invalidation points: `docs/nextjs-caching-strategy.md`. Principle applied: **never share-cache user-specific/sensitive data** — employees, attendance, leave, notifications, dashboards are uncached; only reference data (departments, designations, leave types, holidays, registration options) and public help are cached.

## 5. Relevant file paths
- `docs/nextjs-caching-strategy.md`
- `src/lib/server/api-client.ts`
- `src/lib/server/departments.ts`
- `src/app/(public)/help/[[...slug]]/page.tsx`

## 6. Practical use case
Department dropdowns are identical for every screen and rarely change → cached 5 min, invalidated on edit.

## 7. Why the concept is used
Performance and reduced backend load, with explicit freshness.

## 8. Advantages
- Opt-in = no surprise stale data.
- Tags give surgical invalidation.

## 9. Limitations
- Multiple layers are easy to confuse.
- Per-instance caches when scaled out.

## 10. Common mistakes
- Caching authenticated responses in a shared cache.
- Assuming old Next 13/14 default caching.

## 11. Interview-related considerations
- Name the cache layers.
- Default fetch caching today?
