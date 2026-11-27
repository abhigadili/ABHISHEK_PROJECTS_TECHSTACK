# 17. Rendering strategies

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A rendering strategy decides **when and where** HTML is produced: at build time (static), per request (dynamic/SSR), after a time or event (ISR), in the browser (CSR), or a mix in one route (PPR).

## 2. Syntax
| Strategy | Produced | Typical API (this version) |
|---|---|---|
| SSG | build time | `generateStaticParams`, no runtime APIs |
| ISR | build + regenerated | `'use cache'` + `cacheLife` + `cacheTag`, `revalidateTag` |
| SSR | every request | runtime APIs (`cookies`, `headers`, `searchParams`) / uncached `fetch` under `<Suspense>` |
| CSR | in the browser | `'use client'` + effects / `next/dynamic({ssr:false})` |
| PPR | static shell + streamed holes | default with `cacheComponents: true` |

## 3. How Next.js implements it
Next.js decides per **component tree**, not per page. With Cache Components the old route-level switches (`dynamic`, `revalidate`, `fetchCache`) are removed — you express intent by *where you read runtime data* and *what you cache*. Everything not cached and not inside Suspense that reads runtime data is a build error ("blocking route"), which keeps you honest.

## 4. Actual EMS implementation
See `docs/nextjs-rendering-strategy.md` for the per-route decision table. Summary: landing + docs = SSG; help = ISR; authenticated screens = SSR streamed inside a PPR shell; charts/org-tree/forms = client islands.

## 5. Relevant file paths
- `docs/nextjs-rendering-strategy.md`
- `next.config.ts`
- `src/app/(public)/docs/[...slug]/page.tsx`
- `src/app/(public)/help/[[...slug]]/page.tsx`
- `src/app/(dashboard)/employees/page.tsx`

## 6. Practical use case
Public onboarding docs are the same for everyone → build once (SSG). Employee lists are private and per-user → render per request (SSR).

## 7. Why the concept is used
Match freshness and cost to the data: static where possible, dynamic where required, streamed so users never wait for the slowest part.

## 8. Advantages
- Fast static assets for public content.
- Fresh private data.
- One mental model with PPR.

## 9. Limitations
- Mixed strategies need discipline about what is shared vs per-user.
- Build fails if runtime data escapes Suspense (a feature, but surprising).

## 10. Common mistakes
- Using SSR for public static content (wasteful).
- Caching user-specific output in a shared cache.
- Reading `cookies()` in a layout without Suspense.

## 11. Interview-related considerations
- SSR vs SSG vs ISR vs CSR vs PPR — when each?
- What is a blocking route?
