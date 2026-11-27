# 1. Next.js fundamentals

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Next.js is a **full-stack React framework**: it provides routing, server rendering, data fetching, caching, bundling (Turbopack), image/font optimisation and a server runtime on top of React. Instead of shipping an empty HTML page and building everything in the browser (a classic SPA), Next.js renders React components **on the server** first and sends HTML plus a compact serialised tree (the *RSC payload*), then hydrates only the interactive parts.

## 2. Syntax
```bash
npx create-next-app@latest ems-nextjs --ts --app --eslint --tailwind --src-dir --import-alias "@/*"
npm run dev      # next dev  (Turbopack, fast refresh)
npm run build    # next build
npm start        # next start (production server)
```
```ts
// next.config.ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = { cacheComponents: true, partialPrefetching: true };
export default nextConfig;
```

## 3. How Next.js implements it
* **Routing** is the file system under `src/app` (see docs 03-12). **Rendering** is per route and per component (docs 14-23). **Data** is fetched where it is used, on the server (docs 24-25). **Mutations** are Server Actions (doc 26) and Route Handlers (doc 13). **Caching** is explicit with `'use cache'`, `cacheTag`, `revalidateTag` (docs 28-32).
* The build tool is **Turbopack** (default in this version). `next typegen` generates the global `PageProps<'/route'>`, `LayoutProps<'/route'>` and `RouteContext` helper types used throughout the project.

## 4. Actual EMS implementation
EMS is an employee-management frontend for an **existing Express API**. Next.js is used as a *backend-for-frontend*: the browser only ever talks to the Next.js server (same origin); Server Components, Server Actions, Route Handlers and `proxy.ts` call Express with a Bearer token that lives in an **HttpOnly cookie**. The API URL (`EMS_API_URL`) is a server-only variable. Nothing is mocked in production code; fixtures exist only in tests.

Selected stack and why: Next.js **16.4.5** (latest stable at implementation time, Cache Components + `proxy.ts`), React **19.3.0** (Actions, `useActionState`, `useOptimistic`), TypeScript **5.9** strict, Tailwind CSS 4, zod 3, React Hook Form 7, Redux Toolkit (only for notification badge + sidebar), Recharts (lazy), Vitest + Testing Library + Playwright.

## 5. Relevant file paths
- `next.config.ts`
- `package.json`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/lib/server/api-client.ts`
- `docs/backend-api-integration.md`

## 6. Practical use case
A manager opens `/employees?search=ann`. The server renders the table (data from Express) as HTML — visible even before any JavaScript loads — and streams it into a prerendered shell. Typing in the search box updates the URL and re-renders on the server; only the filter bar ships JavaScript.

## 7. Why the concept is used
A framework removes the undifferentiated work every production React app needs (routing, code splitting, SSR, caching, SEO, image handling) and gives conventions a team can share. Server-side rendering improves first paint and SEO; server-only code keeps secrets and business calls off the client.

## 8. Advantages
- Less client JavaScript (Server Components are not bundled).
- Secrets and API URLs stay on the server.
- Streaming + PPR give fast first paint with fresh data.
- File-system conventions make large apps navigable.
- One language/runtime end to end.

## 9. Limitations
- Needs a Node (or compatible) runtime — not purely static hosting.
- Caching semantics changed between 13/14/15/16 (read the version’s docs).
- Server/client boundary mistakes are the most common bug class.
- Per-instance caches need extra care when scaled out.

## 10. Common mistakes
- Treating Next.js as "React with routing" and putting everything in `use client` files.
- Copying Next 12/13 Pages-Router or old caching snippets (`getServerSideProps`, `export const revalidate`).
- Reading `process.env` secrets in a Client Component (it becomes `undefined` — or worse, bundled if prefixed `NEXT_PUBLIC_`).

## 11. Interview-related considerations
- Explain SSR vs SSG vs ISR vs CSR and when PPR beats them.
- What is hydration and what is a hydration mismatch?
- What does Next.js add over plain React + Vite?
- Why is `NEXT_PUBLIC_` a security-relevant prefix?
