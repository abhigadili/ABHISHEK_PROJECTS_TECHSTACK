# 3. App Router

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
The **App Router** (`app/` directory) is Next.js’s routing and rendering architecture built on React Server Components, nested layouts, Suspense streaming and Server Actions. It replaces the Pages Router (`pages/`, `getServerSideProps`, `getStaticProps`), which is *not used* in this project.

## 2. Syntax
```tsx
// app/layout.tsx  – required root layout (owns <html> and <body>)
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return <html lang="en"><body>{children}</body></html>;
}
// app/employees/page.tsx – a route
export default function Page(props: PageProps<'/employees'>) { /* … */ }
```

## 3. How Next.js implements it
A URL is matched to nested segments; for each segment Next.js composes `layout` → `template` → `error` boundary → `loading` Suspense → `not-found` boundary → `page`. Layouts **persist** across navigations (state and scroll are preserved); pages swap. Navigation is *soft* (only the changed segments are fetched as RSC payload) when done via `<Link>`/`router`.

## 4. Actual EMS implementation
* Root layout: `src/app/layout.tsx` (fonts, metadata, theme/toast/config providers; reads no runtime data so it is part of the static shell).
* Group layouts: `(auth)/layout.tsx`, `(public)/layout.tsx`, `(dashboard)/layout.tsx` (auth shell: sidebar + topbar, wrapped in `<Suspense>`).
* Nested layouts: `dashboard/layout.tsx` (parallel slots), `employees/layout.tsx` (list + modal slot), `employees/[id]/layout.tsx` (header + tabs shared by 5 child routes).
* Special files used: `loading`, `error`, `global-error`, `not-found`, `template`, `default`, `route`, `icon`, `apple-icon`, `manifest`, `robots`, `sitemap`.

## 5. Relevant file paths
- `src/app/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/employees/[id]/layout.tsx`
- `src/app/(dashboard)/template.tsx`
- `src/app/loading.tsx`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/not-found.tsx`

## 6. Practical use case
Switching between the tabs of one employee (`Overview` → `Job history`) re-renders only the tab content; the employee header and the sidebar stay mounted, so no flicker and no repeated header fetch (the header loader is request-memoised anyway).

## 7. Why the concept is used
Nested layouts avoid re-rendering shared chrome, enable streaming at every level, and let each segment own its loading/error UI.

## 8. Advantages
- Shared layouts persist state.
- Per-segment loading/error isolation.
- Streaming by default.
- Typed route props from `next typegen`.

## 9. Limitations
- Layouts cannot read `searchParams` (they don’t re-render on search change) — read them in pages or client hooks.
- A layout and its page cannot pass props to each other (use context, params or re-fetch with memoisation).

## 10. Common mistakes
- Reading `cookies()` in the root layout without `<Suspense>` (blocks the static shell, build error under Cache Components).
- Expecting a layout to re-run on navigation (use `template.tsx`).

## 11. Interview-related considerations
- Layout vs template?
- Where does `error.tsx` catch errors (it does not catch its own layout’s errors)?
- What replaced `getServerSideProps`?
