# 8. Catch-all and optional catch-all routes

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
`[...slug]` matches one or more trailing segments (`/docs/a`, `/docs/a/b`) as an **array**; `[[...slug]]` additionally matches the bare path (`/help` *and* `/help/a/b`) with `slug` undefined.

## 2. Syntax
```tsx
// app/(public)/docs/[...slug]/page.tsx     slug: string[]   (≥ 1)
// app/(public)/help/[[...slug]]/page.tsx   slug?: string[]  (≥ 0)
export default async function Page({ params }: PageProps<'/help/[[...slug]]'>) {
  const { slug = [] } = await params;
}
```

## 3. How Next.js implements it
Catch-all segments must be last in the path. `generateStaticParams` returns arrays (`[{ slug: ['onboarding','first-week'] }]`); for the optional form include `{ slug: [] }` to prerender the index.

## 4. Actual EMS implementation
* **Catch-all** `/docs/[...slug]` renders the public documentation tree (`/docs/onboarding/first-week`, `/docs/policies/leave`, `/docs/privacy`) from `src/content/articles.ts` — SSG via `generateStaticParams`.
* **Optional catch-all** `/help/[[...slug]]` serves the index *and* articles from one file — ISR (`'use cache'`, tag `help`).
* Unknown slugs call `notFound()`; the page metadata uses `robots: { index: false }` for them.

## 5. Relevant file paths
- `src/app/(public)/docs/[...slug]/page.tsx`
- `src/app/(public)/help/[[...slug]]/page.tsx`
- `src/content/articles.ts`
- `src/app/sitemap.ts`

## 6. Practical use case
Content editors add an article to `articles.ts`; it appears at its path, in the sitemap and (for help) can be refreshed on demand without a deployment.

## 7. Why the concept is used
One route file for an unbounded tree of hierarchical paths.

## 8. Advantages
- Hierarchical URLs without a folder per level.
- Index and detail in one file (optional form).

## 9. Limitations
- Must be the last segment.
- `slug` is an array of raw strings — never build file paths from it.

## 10. Common mistakes
- Using `[...slug]` and expecting `/docs` to match (use the optional form).
- Forgetting `slug = []` default.

## 11. Interview-related considerations
- Catch-all vs optional catch-all?
