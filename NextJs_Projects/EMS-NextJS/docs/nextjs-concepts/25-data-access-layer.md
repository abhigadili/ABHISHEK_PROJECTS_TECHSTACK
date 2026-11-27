# 25. Data access layer (DAL)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A DAL is the **single server-only module set** through which an app reads and writes its data source. It centralises authentication of the outgoing call, validation of the incoming data, error mapping and caching decisions, so pages and actions never talk to the API ad hoc.

## 2. Syntax
```ts
import 'server-only';                       // build fails if a Client Component imports this
export const getEmployee = (id: number) => apiFetch(`/employees/${id}`, { schema: employeeSchema }).then((r) => r.data);
```

## 3. How Next.js implements it
`server-only` makes bundlers throw if the module is reachable from client code. `React.cache` gives per-request memoisation; `fetch` options give Data Cache control. Because the DAL runs on the server, it can read HttpOnly cookies via `cookies()`.

## 4. Actual EMS implementation
Layering (outside → in): **page/action/handler → `lib/server/<domain>.ts` → `api-client.ts` → Express**.

* `api-client.ts`: Bearer from cookie, envelope, zod validation (`schemas/api.ts`), `ApiError` (safe messages), timeout/abort, cache opt-in; helpers `apiFetch`, `apiPaged`, `apiFetchRaw` (files/CSV).
* Domain modules: `auth`, `employees`, `departments`, `attendance`, `leaves`, `organization`, `dashboard`, `reports`, `notifications`, `holidays`.
* Access policy modules: `session.ts` (`getSession`, `requireSession`), `permissions.ts` (`requirePermission`, `checkPermission`), `employee-access.ts` (`loadEmployee`).
* The **Express API stays the authority**: the DAL only transports; no business rule is re-implemented (the permission map is a UI mirror, not a replacement).

## 5. Relevant file paths
- `src/lib/server/api-client.ts`
- `src/lib/server/employees.ts`
- `src/lib/server/session.ts`
- `src/lib/server/permissions.ts`
- `src/lib/server/employee-access.ts`
- `src/schemas/api.ts`
- `src/lib/server/env.ts`

## 6. Practical use case
Swapping the transport (adding retries, tracing, a service token) is a one-file change in `api-client.ts`.

## 7. Why the concept is used
Security (one place handles tokens), consistency (one error model), testability (mock one module).

## 8. Advantages
- Single point for auth/caching/error policy.
- Server-only by construction.
- Easy to mock in tests.

## 9. Limitations
- An extra layer to maintain.
- Must remember to route *all* data through it.

## 10. Common mistakes
- Calling `fetch` to the API directly from pages.
- Returning raw backend objects to Client Components.
- Putting secrets in modules that lack `server-only`.

## 11. Interview-related considerations
- What does `server-only` do?
- Why validate API responses at runtime?
