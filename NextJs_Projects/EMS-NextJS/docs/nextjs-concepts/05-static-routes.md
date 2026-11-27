# 5. Static routes

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A static route has a fixed path (no dynamic parameters), e.g. `/dashboard`, `/employees`, `/holidays`. "Static" refers to the *path*; whether the page is statically rendered is a separate question (see docs 17–23).

## 2. Syntax
```tsx
// app/holidays/page.tsx  → /holidays
export const metadata = { title: 'Holidays' };
export default function Page() { return <h1>Holidays</h1>; }
```

## 3. How Next.js implements it
Each static route is a folder with a `page.tsx`. Metadata can be exported statically per route; with Cache Components the page is prerendered to a static shell and runtime data is streamed under Suspense.

## 4. Actual EMS implementation
Examples: `/dashboard`, `/employees`, `/departments`, `/designations`, `/organization`, `/attendance`, `/attendance/calendar`, `/leaves`, `/leaves/apply`, `/leaves/approvals`, `/leaves/admin`, `/leaves/calendar`, `/holidays`, `/reports`, `/users`, `/notifications`, `/profile`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/unauthorized`, `/help`. Each exports `metadata` with a title (the root template renders `%s · EMS`). The static shell (title, header, skeletons) is prerendered; the body streams.

## 5. Relevant file paths
- `src/app/(dashboard)/holidays/page.tsx`
- `src/app/(dashboard)/leaves/apply/page.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/page.tsx`

## 6. Practical use case
`/leaves/apply` is a fixed URL users bookmark; the page needs *today’s* date as the default, so it calls `connection()` first to say "render per request" and avoid freezing a build-time date.

## 7. Why the concept is used
Simple, bookmarkable, cacheable URLs for primary navigation.

## 8. Advantages
- Trivial mental model.
- Best prefetch behaviour.
- Good SEO for public ones.

## 9. Limitations
- Static path does not imply static content — private data still renders per request.

## 10. Common mistakes
- Assuming `○ Static` in build output for authenticated pages (they are `◐ Partial Prerender`).
- Using `new Date()` in a static context (build error under Cache Components) instead of `connection()` or `<Suspense>`.

## 11. Interview-related considerations
- Difference between a static route and static rendering?
