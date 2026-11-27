# 29. Data Cache and revalidation

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
The Data Cache stores the results of `fetch` (and `'use cache'` functions) on the server across requests and deployments. **Time-based revalidation** refreshes entries after N seconds; **on-demand revalidation** refreshes by tag or path.

## 2. Syntax
```ts
fetch(url, { next: { revalidate: 300, tags: ['departments'] } });
revalidateTag('departments', 'max');   // SWR: serve stale, refresh in background
updateTag('departments');              // Server Action only: expire now (read-your-own-writes)
revalidatePath('/departments');
```

## 3. How Next.js implements it
The cache key includes the URL **and the request headers that vary the response** — here the `Authorization` header — so entries are per user. Tags are attached to entries; `revalidateTag(tag, profile)` marks them stale; `updateTag` expires immediately in the same request.

## 4. Actual EMS implementation
`getDepartments`/`getDesignations` (300 s, tags `departments`/`designations`), `getLeaveTypes` (300 s, `leave-types`), `getHolidays`/`getWeeklyOffs` (600 s, `holidays`), `registrationOptions` (300 s, public, `registration-options`). The `apiFetch` option `cache: { revalidate, tags }` is the only way to opt in; the default is `cache: 'no-store'`. Server Actions call `updateTag` after writes; the webhook uses `revalidateTag(tag,'max')`.

## 5. Relevant file paths
- `src/lib/server/api-client.ts`
- `src/lib/server/departments.ts`
- `src/lib/server/leaves.ts`
- `src/lib/server/holidays.ts`
- `src/lib/server/auth.ts`
- `src/app/api/revalidate/route.ts`

## 6. Practical use case
HR renames a department; the redirect target immediately shows the new name because the action used `updateTag`.

## 7. Why the concept is used
Fast reference-data reads with predictable invalidation.

## 8. Advantages
- Fewer backend calls.
- Precise invalidation by tag.

## 9. Limitations
- Per-token entries reduce hit rate (safe by design).
- Eventually consistent for `revalidateTag`.

## 10. Common mistakes
- Using `updateTag` outside a Server Action.
- Missing a tag on a mutation path.

## 11. Interview-related considerations
- `revalidateTag` vs `updateTag` vs `revalidatePath`?
