# Caching strategy (Next.js 16.4.5 with `cacheComponents`)

> **Version note.** This project enables `cacheComponents: true` (and `partialPrefetching`) in `next.config.ts`. In this mode the older route-segment configs (`export const dynamic / revalidate / fetchCache / runtime / dynamicParams`) are **rejected at build time**; caching is expressed with `'use cache'`, `cacheLife()`, `cacheTag()` and `fetch(..., { next: { revalidate, tags } })`. `revalidateTag(tag, 'max')` takes a profile argument; `updateTag(tag)` exists only inside Server Actions (read-your-own-writes). Pages-Router APIs (`getStaticProps`, `getServerSideProps`) are not used anywhere.

## The golden rules applied here

1. **User-specific or sensitive data is never shared-cached.** Employees, attendance, leave, notifications, profile, dashboard, compensation … are fetched **per request** with `cache: 'no-store'` (the default in `apiFetch`).
2. **Only reference data and public content opt in to caching**, and only with an explicit lifetime and a tag.
3. Every cached read has a matching **invalidation** in the Server Action (or webhook) that changes it.
4. Runtime data (`cookies()`, `headers()`, `params`, `searchParams`) is read **inside `<Suspense>`** so the static shell can be prerendered and the dynamic holes stream.

## The four Next.js cache layers and where each is used

| Layer | What | EMS usage | Files |
|---|---|---|---|
| **Request memoization** (React `cache`) | de-duplicates identical calls *within one render* | `getSession()` (called by layout, page and children but hits `/auth/me` once), `loadEmployee()`, `getDashboard()` | `lib/server/session.ts`, `lib/server/employee-access.ts`, `lib/server/dashboard.ts` |
| **Data Cache** (`fetch` + `next.revalidate/tags`) | server-side cache of upstream responses, survives requests | departments, designations, leave types, holidays, weekly offs, registration options | `lib/server/departments.ts`, `leaves.ts`, `holidays.ts`, `auth.ts` |
| **`'use cache'`** (Cache Components) | caches a component/function result with `cacheLife` + `cacheTag` | public Help articles (ISR) | `app/(public)/help/[[...slug]]/page.tsx` |
| **Full Route Cache / static shell** | prerendered HTML (+ RSC payload) | landing page, docs (SSG), help (ISR), register shell (PPR), static part of every dynamic page | build output below |
| **Router Cache** (client) | prefetched / visited RSC payloads in the browser | `<Link>` prefetch in the sidebar and tables; soft navigation; `router.refresh()` after mutations | `features/layout/NavLinks.tsx` |

> **Important detail — the Authorization header is part of the Data Cache key.** The cached department list is fetched *with the signed-in user's bearer token*, therefore each session gets its own entry. That is deliberate: even if a backend one day filters a reference list by role, a user can never read an entry that was produced for another user. The cost is a lower hit rate, which is acceptable for small reference lists (documented trade-off, see *Limitations*).

## Cached data catalogue

| Data | Where cached | Lifetime | Tag | Invalidated by |
|---|---|---|---|---|
| Departments (list, form dropdowns) | Data Cache | 300 s | `departments` | `saveDepartmentAction`, `setDepartmentStatusAction`, `saveEmployeeAction`, `toggleEmployeeStatusAction` (headcount changes) → `updateTag('departments')` |
| Designations | Data Cache | 300 s | `designations` | `saveDesignationAction`, `setDesignationActiveAction` → `updateTag('designations')` |
| Leave types | Data Cache | 300 s | `leave-types` | `createLeaveTypeAction` → `updateTag('leave-types')` |
| Holidays / weekly offs | Data Cache | 600 s | `holidays` | `createHolidayAction`, `deleteHolidayAction` → `updateTag('holidays')` |
| Registration options (public) | Data Cache | 300 s | `registration-options` | time-based; `POST /api/revalidate {"tag":"registration-options"}` |
| Help articles | `'use cache'` | stale 5 min / revalidate 1 h / expire 1 d | `help` | `POST /api/revalidate {"tag":"help"}` |
| Docs articles | build-time (SSG) | until next deploy | — | redeploy |
| **Everything else** | **not cached** | — | — | — |

Never cached (by design): employee records/pictures (`Cache-Control: private, max-age=120` only in the browser), attendance, leave requests and balances, notifications, profile, org chart, reports, dashboard, `/auth/me`.

## Invalidation mechanics

```ts
// Server Action (src/actions/departments.ts) — the user must see their own write immediately
updateTag('departments');          // expire now (read-your-own-writes)
revalidatePath('/departments');    // re-render the list page
redirect(`/departments/${id}`);

// Webhook / CMS (src/app/api/revalidate/route.ts) — stale-while-revalidate
revalidateTag('help', 'max');      // serve the old page while the new one renders
```

`POST /api/revalidate` requires the `x-revalidate-secret` header (constant-time compare, `EMS_REVALIDATE_SECRET`), accepts only an allow-list of tags and never an arbitrary one (`tests/revalidate-route.test.ts`).

## Verified build output (`next build`)

```text
○ /help                     1h   1d      ← ISR: revalidate 1 hour, expire 1 day
○ /help/getting-started     1h   1d
○ /register                 5m   1y      ← static shell; registration options cached 5 min
○ /docs/onboarding/first-week            ← SSG (generateStaticParams)
◐ /employees, /dashboard, …              ← Partial Prerender: static shell + streamed dynamic holes
```

## Limitations & caveats (honest)

* Data Cache entries are per bearer token → low hit rate, but safe. A shared (token-less) cache would require a public backend endpoint.
* In-memory/disk cache is **per instance**; with several instances use a shared cache handler (see `docs/deployment.md`) or accept that each instance fills its own.
* `updateTag` only works in Server Actions; Route Handlers and webhooks must use `revalidateTag(tag, 'max')` (eventual consistency).
* The first request after a long idle period may be slow while the upstream is re-fetched (stale-while-revalidate hides this for tagged `max` revalidations).
* Dynamic `notFound()` under PPR can answer HTTP 200 with `noindex` for the first hit of an unknown slug (see `docs/nextjs-rendering-strategy.md`).

## Tests

`tests/actions.test.ts` asserts the exact `updateTag` / `revalidatePath` calls after successful writes and that a **failed** write invalidates nothing; `tests/api-client.test.ts` asserts that default calls are `no-store` and that opt-in calls pass `next: { revalidate, tags }`; `tests/revalidate-route.test.ts` covers the webhook.
