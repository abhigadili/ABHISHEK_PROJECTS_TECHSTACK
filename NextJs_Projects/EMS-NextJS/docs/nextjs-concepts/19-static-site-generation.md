# 19. Static site generation (SSG)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
SSG renders HTML **once at build time** and serves it from disk/CDN. Dynamic paths are enumerated with `generateStaticParams`.

## 2. Syntax
```tsx
export function generateStaticParams() { return DOCS.map((a) => ({ slug: a.slug })); }
export async function generateMetadata({ params }: PageProps<'/docs/[...slug]'>) { … }
```

## 3. How Next.js implements it
A route with no runtime data access and fully known params is prerendered (`○` in the build output). `generateMetadata` runs at build for each path.

## 4. Actual EMS implementation
`/` (landing) and every article under `/docs/**` (`○ /docs/onboarding/first-week`, `/docs/onboarding/accounts`, `/docs/policies/attendance`, `/docs/policies/leave`, `/docs/privacy`). Content lives in `src/content/articles.ts` — public, non-sensitive text, which is exactly why SSG is appropriate. Per-article title/description/canonical/Open Graph are generated; the sitemap is built from the same array so pages and sitemap cannot drift.

## 5. Relevant file paths
- `src/app/(public)/docs/[...slug]/page.tsx`
- `src/content/articles.ts`
- `src/app/page.tsx`
- `src/app/sitemap.ts`
- `tests/seo.test.ts`

## 6. Practical use case
Publishing a policy page: edit the content, deploy; it is served as static HTML.

## 7. Why the concept is used
Zero server work per request, best TTFB and SEO for public content.

## 8. Advantages
- Fastest delivery.
- CDN-friendly.
- Cheap to scale.

## 9. Limitations
- Content changes need a rebuild/redeploy (use ISR for faster edits).
- Unknown paths are rendered on demand (see the soft-404 caveat in the rendering doc).

## 10. Common mistakes
- Using SSG for per-user data.
- Forgetting to list new slugs in `generateStaticParams`.

## 11. Interview-related considerations
- When would you choose SSG over ISR?
