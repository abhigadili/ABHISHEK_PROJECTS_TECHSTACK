# 31. Router Cache and request memoization

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
**Request memoization** de-duplicates identical calls *during a single server render* (`fetch` and `React.cache`). The **Router Cache** is a *browser-side* cache of visited/prefetched RSC payloads that makes navigation instant.

## 2. Syntax
```ts
export const getSession = cache(async () => { … });         // one /auth/me per render
export const loadEmployee = cache(async (id: number) => …);  // layout + page + modal share it
router.refresh();                                            // drop & refetch the current route’s server data
```

## 3. How Next.js implements it
Memoisation lives for the render only (no cross-request leakage — important for per-user data). The Router Cache holds prefetched `<Link>` targets and visited segments for a short time (and is invalidated by `router.refresh()`, Server Action revalidation, and cookie changes).

## 4. Actual EMS implementation
* `getSession` — called by the shell, guards and pages but hits `/auth/me` once per request. A 401/403 resolves to `null`; other errors rethrow.
* `loadEmployee` — used by `[id]/layout`, the tab pages and the intercepted modal.
* `getDashboard` — the three parallel slots share one backend call.
* Router Cache: sidebar `<Link>` prefetching; after mutations, actions call `revalidatePath`/`updateTag` so the next visit is fresh, and client code calls `router.refresh()` (`EmployeeForm`, `CheckCard`).

## 5. Relevant file paths
- `src/lib/server/session.ts`
- `src/lib/server/employee-access.ts`
- `src/lib/server/dashboard.ts`
- `src/features/employees/EmployeeForm.tsx`
- `src/features/attendance/CheckCard.tsx`

## 6. Practical use case
Saving an employee then landing on the profile shows the saved data, not a stale prefetched copy, because the action revalidates and the client refreshes.

## 7. Why the concept is used
Avoid duplicate work per render; make navigation feel instant.

## 8. Advantages
- No duplicate backend calls per request.
- Instant back/forward.

## 9. Limitations
- **Previously visited routes stay mounted but hidden** (Next 16 preserves their state for back/forward). Their DOM — including form controls and ids — is still in the document, so a test or script that queries by `name`/label can match a *hidden* control from the previous page. Playwright: use `:visible`, `getByRole` (which ignores hidden nodes) or wait for the new page’s heading (see `e2e/modules.spec.ts` M8).
- Memoisation does not persist across requests.
- Router Cache staleness must be managed after mutations.

## 10. Common mistakes
- Assuming `React.cache` is a cross-request cache.
- Skipping `router.refresh()` after a client-side mutation.

## 11. Interview-related considerations
- Request memoization vs Data Cache?
- When is the Router Cache invalidated?
