# 20. Incremental static regeneration (ISR)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
ISR serves a static page and **regenerates it in the background** after a time window or on demand, so content can change without a full redeploy.

## 2. Syntax
```tsx
async function HelpContent({ slug }: { slug: string[] }) {
  'use cache';
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag('help');
  …
}
// webhook
revalidateTag('help', 'max');          // stale-while-revalidate
```

## 3. How Next.js implements it
With Cache Components, ISR is a cached component: `cacheLife` sets *stale* (client may reuse), *revalidate* (server regenerates after), *expire* (hard limit); `cacheTag` enables `revalidateTag`/`updateTag`. `generateStaticParams` still prerenders known slugs at build time. In this version `revalidateTag` requires a profile argument; `updateTag` exists only in Server Actions.

## 4. Actual EMS implementation
`/help` and `/help/<article>` — ISR (`○ /help 1h 1d` in the build output). A visible *Generated at …* stamp (`data-testid="generated-at"`) lets you watch regeneration. `POST /api/revalidate {"tag":"help"}` with header `x-revalidate-secret` forces a refresh (constant-time secret check, allow-listed tags, unit-tested).

## 5. Relevant file paths
- `src/app/(public)/help/[[...slug]]/page.tsx`
- `src/app/api/revalidate/route.ts`
- `src/content/articles.ts`
- `docs/nextjs-caching-strategy.md`
- `tests/revalidate-route.test.ts`

## 6. Practical use case
A CMS/webhook edits help text and calls the revalidate endpoint; visitors get the new page within moments, without a deployment.

## 7. Why the concept is used
Static speed with controlled freshness.

## 8. Advantages
- CDN-like speed.
- Fresh within a bounded time or instantly on demand.

## 9. Limitations
- Per-instance cache unless a shared cache handler is configured.
- Stale content may be served once (stale-while-revalidate).

## 10. Common mistakes
- Caching anything user-specific.
- Exposing the revalidate endpoint without a secret.
- Using the removed `export const revalidate` segment config (not allowed with `cacheComponents`).

## 11. Interview-related considerations
- ISR vs SSG vs SSR?
- `revalidateTag` vs `updateTag`?
