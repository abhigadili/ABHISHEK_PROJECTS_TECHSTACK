# 32. Cache invalidation

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Invalidation decides *when cached data stops being served*: after a time (`revalidate`/`cacheLife`), when a tag is revalidated, when a path is revalidated, or when the app is redeployed.

## 2. Syntax
```ts
updateTag('departments'); revalidatePath('/employees'); revalidatePath(`/employees/${id}`, 'layout');   // Server Action
revalidateTag('help', 'max');                                                                              // webhook
```

## 3. How Next.js implements it
`updateTag` = expire immediately (read-your-own-writes, actions only). `revalidateTag(tag,'max')` = stale-while-revalidate. `revalidatePath(path, 'layout'|'page')` invalidates a route’s cached output and the Router Cache.

## 4. Actual EMS implementation
Invalidation matrix (each row is asserted in `tests/actions.test.ts`):

| Mutation | Invalidates |
|---|---|
| create/edit employee, (de)activate | `departments` (headcount), `/employees`, `/dashboard`, `/employees/:id` (layout) |
| department save / activate | `departments`, `/departments` |
| designation save / toggle | `designations`, `/designations` |
| leave type created | `leave-types`, `/leaves/admin` |
| leave decision | `/leaves` (layout), `/dashboard` |
| leave cancel | `/leaves` (layout) |
| holiday create/delete | `holidays`, `/holidays` |
| check-in | `/attendance`, `/dashboard` |
| check-out | `/attendance` |
| notifications read | `/notifications` (+ client bell refetch) |
| webhook | allow-listed tags only (`help`, `departments`, …) |

A **failed** write invalidates nothing (asserted for the employee save in `tests/actions.test.ts`).

## 5. Relevant file paths
- `src/actions/employees.ts`
- `src/actions/departments.ts`
- `src/actions/leaves.ts`
- `src/actions/holidays.ts`
- `src/app/api/revalidate/route.ts`
- `tests/actions.test.ts`
- `tests/revalidate-route.test.ts`

## 6. Practical use case
Adding a holiday updates the cached list at once for the person who added it, and within ten minutes (or on the next webhook) elsewhere.

## 7. Why the concept is used
Correctness of cached views after writes.

## 8. Advantages
- Explicit, testable.

## 9. Limitations
- Easy to miss a path/tag when adding a feature (the matrix + tests mitigate).
- Multi-instance deployments need a shared cache handler.

## 10. Common mistakes
- Revalidating too much (defeats caching) or too little (stale UI).
- Using the removed `revalidateTag(tag)` single-argument form.

## 11. Interview-related considerations
- How do you guarantee a user sees their own write? (`updateTag`)
