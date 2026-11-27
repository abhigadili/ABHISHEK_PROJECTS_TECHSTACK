# 18. Server-side rendering (SSR)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
SSR renders a route's HTML on the server **for every request**, using request-specific data (cookies, query string).

## 2. Syntax
```tsx
export default function Page({ searchParams }: PageProps<'/employees'>) {
  return <Suspense fallback={<Skeleton/>}><Table searchParams={searchParams} /></Suspense>;
}
async function Table({ searchParams }) { const sp = await searchParams; /* runtime data */ … }
```

## 3. How Next.js implements it
In this version SSR is "whatever reads runtime data inside Suspense": the static shell is flushed immediately and the dynamic region renders per request and streams in. `fetch` without cache options is per-request (`cache: 'no-store'` is set explicitly by `apiFetch`).

## 4. Actual EMS implementation
Employees list, employee details and tabs, attendance (history, team view, calendar), leaves (list, detail, approvals, admin, team calendar), notifications, reports, users, profile, organization, holidays, department/designation pages. They share a pattern: *static header + `<Suspense>` + async body*, `Promise.all` for independent fetches, `requirePermission`/`requireSession` inside the body, URL-driven filters. Per-user data is never cached.

## 5. Relevant file paths
- `src/app/(dashboard)/employees/page.tsx`
- `src/app/(dashboard)/attendance/page.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/app/(dashboard)/leaves/page.tsx`

## 6. Practical use case
A manager’s `/leaves/approvals` shows exactly *their* pending requests (the backend scopes by token), rendered server-side, visible without JS.

## 7. Why the concept is used
Private, always-fresh data and SEO-irrelevant but fast first paint.

## 8. Advantages
- Always fresh.
- No client waterfalls.
- Works without JavaScript for read paths.

## 9. Limitations
- Server work per request.
- Needs a running server.
- Latency of the backend is on the critical path (mitigated by streaming).

## 10. Common mistakes
- Awaiting searchParams outside Suspense.
- Awaiting sequentially instead of `Promise.all`.

## 11. Interview-related considerations
- Why can SSR still be fast? (streaming + PPR shell)
