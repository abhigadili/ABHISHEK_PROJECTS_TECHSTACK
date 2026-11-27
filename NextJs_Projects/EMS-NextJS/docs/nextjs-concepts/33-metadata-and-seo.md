# 33. Metadata and SEO

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Next.js builds `<head>` from the **Metadata API**: static `export const metadata`, dynamic `generateMetadata`, and file conventions (`icon`, `manifest`, `robots`, `sitemap`). Good SEO also depends on crawlable HTML, canonical URLs, semantic markup and *keeping private pages out of the index*.

## 2. Syntax
```ts
export const metadata: Metadata = { metadataBase: new URL(appUrl), title: { default: 'EMS', template: '%s · EMS' }, openGraph: {…}, robots: { index: true } };
export async function generateMetadata({ params }: PageProps<'/help/[[...slug]]'>): Promise<Metadata> { … alternates: { canonical } … }
```

## 3. How Next.js implements it
Metadata merges from root to leaf (child fields override). `generateMetadata` may be async and its fetches are memoised with the page. `metadataBase` resolves relative URLs for canonical/Open Graph.

## 4. Actual EMS implementation
* **Root metadata** (`app/layout.tsx`): `metadataBase` from `NEXT_PUBLIC_APP_URL`, title template `%s · EMS`, description, keywords, canonical `/`, Open Graph (title, description, site name, 1200×630 image) and Twitter card, theme-color in `viewport`.
* **Per-page titles:** every screen exports `metadata = { title }`.
* **Dynamic metadata** for public content: `/docs/[...slug]` and `/help/[[...slug]]` build title/description/canonical/Open Graph (`type: 'article'`) from the article; unknown slugs return `robots: { index: false }`.
* **Authenticated pages are not indexed:** `(dashboard)/layout.tsx` exports `robots: { index:false, follow:false, nocache:true }` and `robots.txt` disallows those paths.
* **Privacy:** private record pages (`/employees/[id]`) use a *static* title — no employee name is ever placed in `<head>`, where crawlers and link-preview bots could read it.
* Verified in tests: `tests/seo.test.ts` (robots/sitemap/manifest/articles) and `e2e/learn.spec.ts` (noindex marker for not-found).
* Not implemented (stated honestly): JSON-LD structured data — there is no public entity worth marking up.

## 5. Relevant file paths
- `src/app/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(public)/docs/[...slug]/page.tsx`
- `src/app/(public)/help/[[...slug]]/page.tsx`
- `src/app/(dashboard)/employees/[id]/page.tsx`
- `src/app/robots.ts`
- `tests/seo.test.ts`

## 6. Practical use case
Sharing a help article in chat renders a proper title, description and card image; sharing an employee URL reveals nothing.

## 7. Why the concept is used
Discoverability for public content, privacy for private content.

## 8. Advantages
- Type-safe, composable, server-rendered.
- No client JS for SEO.

## 9. Limitations
- `generateMetadata` runs before streaming completes for that segment; slow metadata delays the head.
- Per-page OG images for private pages would leak data.

## 10. Common mistakes
- Putting personal data in titles/descriptions.
- Forgetting `metadataBase` (broken absolute URLs).
- Relying on robots.txt alone for privacy (use noindex + auth).

## 11. Interview-related considerations
- Metadata API vs `<Head>` from Pages Router?
- How are canonical URLs set?
