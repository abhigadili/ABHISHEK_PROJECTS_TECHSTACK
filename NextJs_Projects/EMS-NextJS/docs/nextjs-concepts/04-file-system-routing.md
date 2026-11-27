# 4. File-system routing

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Routes are defined by **folders** under `app/`; a folder becomes a URL segment, and it becomes publicly reachable only when it contains a `page.tsx` (UI) or `route.ts` (HTTP handler).

## 2. Syntax
```text
app/employees/page.tsx            → /employees
app/employees/[id]/page.tsx       → /employees/42
app/employees/[id]/edit/page.tsx  → /employees/42/edit
app/api/health/route.ts           → /api/health
```

## 3. How Next.js implements it
The router compiles the tree into a route table at build time; dynamic segments (`[id]`), catch-alls (`[...slug]`), optional catch-alls (`[[...slug]]`), groups `(name)`, slots `@name` and interceptors `(.)` are *folder-name conventions*. `next typegen` turns the table into the `AppRoutes` union that types `PageProps<'/employees/[id]'>`.

## 4. Actual EMS implementation
The complete route table is visible in the `next build` output; see doc 03 for the file list. Every route has a protection decision: public routes are listed in `src/proxy.ts › PUBLIC`; everything else needs a session (redirect to `/login?next=…`).

## 5. Relevant file paths
- `src/app/**`
- `src/proxy.ts`
- `.next/types (generated)`

## 6. Practical use case
Deep links work everywhere: pasting `/employees/42/job-history` into a new browser tab renders that exact tab after login (the `?next=` parameter survives the login redirect, see doc 35).

## 7. Why the concept is used
Routes-as-folders makes the URL space discoverable from the repo and lets Next.js analyse routes at build time for prefetching, code splitting and static generation.

## 8. Advantages
- No router configuration file.
- Build-time route analysis (static shell, prefetch).
- Type-safe route helpers.

## 9. Limitations
- Every routable thing needs its own folder → deep trees.
- Dynamic folders with the same depth but different names conflict (`[id]` vs `[slug]`).

## 10. Common mistakes
- Putting a `page.tsx` and a `route.ts` in the same folder (conflict).
- Forgetting that a folder without `page`/`route` is not routable.

## 11. Interview-related considerations
- How are `/a/b` and `/a/[x]` prioritised? (static before dynamic)
- What is a route group and does it change the URL?
