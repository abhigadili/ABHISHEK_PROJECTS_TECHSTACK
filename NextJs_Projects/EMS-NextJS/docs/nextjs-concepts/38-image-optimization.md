# 38. Image optimisation

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
`next/image` serves responsive, lazy-loaded, modern-format images, reserves layout space (no CLS) and prioritises the LCP image.

## 2. Syntax
```tsx
<Image src="/images/hero.png" alt="…" width={1200} height={630} priority sizes="(min-width: 1024px) 560px, 100vw" />
<Image src={`/api/employees/${id}/picture`} alt={`Photo of ${name}`} width={size} height={size} unoptimized />
```

## 3. How Next.js implements it
The built-in optimizer fetches the source **server-side without the user’s cookies** and may store the result in a shared cache — so only public images belong there. `formats` in `next.config.ts` enable AVIF/WebP. `unoptimized` bypasses it.

## 4. Actual EMS implementation
* **Public assets through the optimizer:** landing hero (`priority`, `sizes`, explicit width/height) and the logo in the public header.
* **Private employee pictures are deliberately `unoptimized`:** they come from the authenticated route handler `/api/employees/[id]/picture` (`Cache-Control: private`), so a public optimizer/CDN can never cache someone’s photo; there is **no** `remotePatterns` entry that would let the optimizer fetch them. Explicit `width`/`height` still prevent layout shift; images are lazy by default; initials are the fallback (`Avatar`).
* The registration form previews a chosen file with a blob URL in a plain `<img>` (a local file cannot go through an optimizer) with the lint rule disabled and justified.

## 5. Relevant file paths
- `src/app/page.tsx`
- `src/components/layout/PublicChrome.tsx`
- `src/components/common/Avatar.tsx`
- `src/app/api/employees/[id]/picture/route.ts`
- `next.config.ts`
- `src/features/auth/AuthForms.tsx`

## 6. Practical use case
The LCP hero loads fast; employee photos are never stored in a shared cache.

## 7. Why the concept is used
Performance for public images, privacy for private ones.

## 8. Advantages
- Smaller images, no CLS, lazy loading.

## 9. Limitations
- Private images get no resizing (the backend serves originals — keep uploads small; the upload limit is 2 MB).

## 10. Common mistakes
- Using the optimizer for authenticated images (cache leak).
- Omitting width/height (layout shift).

## 11. Interview-related considerations
- Why `unoptimized` for avatars?
- What does `priority` do?
