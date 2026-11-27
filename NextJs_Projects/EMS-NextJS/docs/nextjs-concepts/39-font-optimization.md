# 39. Font optimisation

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
`next/font` downloads/self-hosts fonts at **build time**, subsets them, serves them from your domain and applies `size-adjust` fallbacks so text does not shift when the font loads. No runtime request to Google.

## 2. Syntax
```ts
const inter = localFont({ src: './fonts/Inter-Variable.woff2', variable: '--font-inter', weight: '100 900', display: 'swap' });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });
```

## 3. How Next.js implements it
Fonts become CSS variables applied on `<html>`; Tailwind maps `font-sans`/`font-mono` to them.

## 4. Actual EMS implementation
`app/layout.tsx`: **local variable font** Inter (`app/fonts/Inter-Variable.woff2`, via `@fontsource-variable/inter`) for body text and **Google font** Geist Mono (self-hosted at build) for code/IDs. Both use `display: swap`.

## 5. Relevant file paths
- `src/app/layout.tsx`
- `src/app/fonts/Inter-Variable.woff2`
- `src/app/globals.css`

## 6. Practical use case
Employee codes render in a monospaced face without any third-party request at runtime (privacy and speed).

## 7. Why the concept is used
Avoid FOIT/CLS and third-party round trips.

## 8. Advantages
- Self-hosted, no layout shift, GDPR-friendlier.

## 9. Limitations
- Build needs network access for Google fonts (use local files for offline CI).

## 10. Common mistakes
- Importing fonts with a CSS `@import` from Google (render-blocking, third-party).
- Loading many weights unnecessarily.

## 11. Interview-related considerations
- Why is next/font faster than a `<link>` to Google Fonts?
