# 30. Full Route Cache (static shell)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
The Full Route Cache stores the **prerendered output of a route** (HTML + RSC payload) at build time and serves it for matching requests. With Cache Components the cached part is the *static shell* of each route.

## 2. Syntax
```text
○ /help            1h  1d     ← prerendered, regenerated
○ /docs/privacy              ← prerendered at build
◐ /employees                 ← static shell cached, holes rendered per request
```

## 3. How Next.js implements it
Routes with runtime data are partially prerendered; the shell is reused for every visitor, so it **must never contain user data** — which is why runtime reads are confined to Suspense boundaries. Revalidation (tag/path/time) refreshes it; a new deployment replaces it.

## 4. Actual EMS implementation
Shell-level static content: root layout, public chrome, skeletons, page titles. Per-user content is never part of it (session reads sit under Suspense in `(dashboard)/layout.tsx`). Verified by the build output and the e2e proxy tests (anonymous requests never see employee data).

## 5. Relevant file paths
- `src/app/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/page.tsx`
- `src/app/(public)/docs/[...slug]/page.tsx`

## 6. Practical use case
Anonymous visitors of `/` are served instantly from the prerendered output.

## 7. Why the concept is used
Skip rendering work for what is identical for everyone.

## 8. Advantages
- Very fast shells.
- Safe because user data is excluded structurally.

## 9. Limitations
- Per-instance on disk.
- Stale until revalidated or redeployed.

## 10. Common mistakes
- Putting user-specific text in a layout outside Suspense.

## 11. Interview-related considerations
- Full Route Cache vs Data Cache?
