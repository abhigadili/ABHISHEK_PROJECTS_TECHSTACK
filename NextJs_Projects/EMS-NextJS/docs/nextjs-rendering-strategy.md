# Rendering strategy (Next.js 16.4.5, App Router, `cacheComponents`)

> **Version note.** With `cacheComponents: true`, **Partial Prerendering (PPR) is the default rendering model**: every route is prerendered to a *static shell*, and anything that reads runtime data (`cookies()`, `headers()`, `params` that are not pre-generated, `searchParams`, uncached `fetch`) must sit under `<Suspense>`; those "holes" stream in per request. `export const dynamic = 'force-static' | 'force-dynamic'`, `revalidate`, `fetchCache`, `runtime` and `dynamicParams` are **not allowed** in this mode (the build fails), so the classic SSR/SSG/ISR switches below are expressed through `'use cache'`, `generateStaticParams`, `connection()` and `<Suspense>` instead.

## Decision table

| Route | Strategy | Why | Mechanism (file) |
|---|---|---|---|
| `/` landing | **SSG** (fully static) | public, identical for everyone | no runtime APIs in `app/page.tsx` |
| `/docs/[...slug]` | **SSG** | public documentation, changes only on deploy | `generateStaticParams()` over `DOCS` (`app/(public)/docs/[...slug]/page.tsx`) |
| `/help/[[...slug]]` | **ISR** | public help that editors update | `'use cache'` + `cacheLife({revalidate: 3600})` + `cacheTag('help')`, on-demand `POST /api/revalidate` |
| `/register`, `/login`, `/forgot-password` | **PPR** (static shell, tiny dynamic hole) | forms are static; `?next=`/`?registered=` and registration options stream/cached | `app/(auth)/**` |
| `/dashboard` | **SSR + streaming** (PPR shell) | per-user, per-request KPIs | three parallel slots `@kpis`, `@charts`, `@events`, each its own `<Suspense>` + `loading.tsx`/`error.tsx` |
| `/employees` | **SSR + streaming** | filters in the URL, per-user data | `searchParams` awaited inside `<Suspense>`; table keyed by params |
| `/employees/[id]/**` | **SSR + streaming** | private record | `loadEmployee()` (request-memoised) in `[id]/layout.tsx` header under `<Suspense>` |
| `/attendance`, `/leaves/**`, `/notifications`, `/reports`, `/users`, `/profile`, `/organization`, `/departments`, `/designations`, `/holidays` | **SSR + streaming** | per-user (some read-only reference data cached) | each page: static header + `<Suspense>` body |
| `/learn/**` | **SSG / PPR demos** | isolated demos | `app/(public)/learn/**` |
| `/api/**` | **Route Handlers** (always dynamic) | BFF endpoints, files, webhook | `app/api/**/route.ts` |

Build output: `○ static`, `◐ partial prerender`, `ƒ dynamic` — `◐` is the dominant symbol for the authenticated app, `○` for `/`, `/help/*`, `/docs/*`.

## SSR (server-side rendering)

*Where:* `/employees`, `/attendance`, `/leaves`, … *How:* the page component itself is synchronous and static; it renders `<Suspense fallback={<Skeleton/>}><Body searchParams={searchParams}/></Suspense>`; `Body` awaits `searchParams`, reads the session cookie (via `apiFetch`) and renders HTML **on the server per request**. The browser receives the shell immediately and the table streams in. No JavaScript is required to *see* the data.

## SSG (static site generation)

`/docs/[...slug]` returns every known slug from `generateStaticParams`; Next.js renders them once at build time (`○ /docs/onboarding/first-week`, `○ /docs/privacy`, …). `generateMetadata` provides per-article title/description/canonical/Open Graph. There is **no employee data** in these pages, which is why static generation is safe.

## ISR (incremental static regeneration)

`/help` pages are prerendered at build time *and* regenerated: after the hour the first visitor gets the stale page while Next re-renders in the background; `POST /api/revalidate {"tag":"help"}` forces it. A `Generated at …` stamp inside the cached component makes regeneration observable (`data-testid="generated-at"`).

## Streaming and Suspense

* Route-level `app/loading.tsx` and `employees/[id]/loading.tsx`; component-level `<Suspense>` around each data region.
* The dashboard's three slots stream **independently**: a slow chart does not delay KPIs, and an error in one slot renders its own `error.tsx` (`@charts/error.tsx`) while the rest stays usable.
* `connection()` (from `next/server`) marks "this depends on the request time" before using `new Date()` so a *static* context never freezes a timestamp (`attendance/calendar`, `holidays`, `leaves/apply`).

## Partial prerendering (PPR)

Implemented by `cacheComponents` (not an experimental flag in this version). Concretely: open `/employees` → the sidebar, header and page title are in the **static shell**; the list is a hole. `partialPrefetching: true` lets `<Link>` prefetch the static part of a dynamic route ahead of time, so navigation feels instant. Experimental, version-specific: `cacheComponents` and `partialPrefetching` are both opt-in options in 16.4.5.

## Client-side rendering (CSR)

Only where interaction demands it: `DashboardCharts` (Recharts; `next/dynamic`, `ssr:false` via `ChartsLazy.tsx`), the org tree, the employee form (React Hook Form), the notification bell, the check-in card (`CheckCard` reads today's record from `/api/attendance/today`). These are small **client islands** inside server-rendered pages.

## Dynamic APIs and `notFound()` — a caveat worth knowing

For a **dynamic, not-pre-generated** segment (e.g. `/learn/navigation/does-not-exist`, `/docs/unknown`) PPR sends the static shell first; if the component then calls `notFound()`, the HTTP status has already been committed. On a *cold first hit* the response can therefore be **200** with `<meta name="robots" content="noindex">` and the RSC marker `NEXT_HTTP_ERROR_FALLBACK;404`; subsequent hits answer **404**. The not-found UI is still shown to users, search engines are told `noindex`, and `sitemap.xml` only lists valid slugs. If a hard 404 status is a requirement for a public page, give that route a fully static param set and avoid reading `params` outside `generateStaticParams` coverage. The e2e test `L2` asserts the marker + `noindex` rather than a status for this reason.

## Verified behaviours (live, production build)

* `/` and `/help` `200` without a session; `/employees` `307 → /login?next=…` (see `tests/proxy.test.ts`, e2e *15/16*).
* `/employees/999999` shows the segment `not-found` UI (e2e *5/18*).
* Intercepted modal on soft navigation, full page on direct navigation/refresh (e2e *19*, *L3*).
