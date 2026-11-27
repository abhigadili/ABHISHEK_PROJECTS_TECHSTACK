# 13. Route Handlers

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A **Route Handler** (`route.ts`) defines an HTTP endpoint with the Web `Request`/`Response` API; export functions named after the verbs: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.

## 2. Syntax
```ts
// app/api/employees/[id]/route.ts
export const GET = protectedHandler<{ id: string }>({}, async (_req, _user, p) => NextResponse.json(await getEmployee(Number(p.id))));
export const PATCH = protectedHandler({ mutating: true, permission: 'employee:manage' }, async (req) => { … });
```

## 3. How Next.js implements it
Handlers are dynamic by default under Cache Components; they get a `NextRequest` (cookies, `nextUrl.searchParams`) and a typed `RouteContext` (`params` is a Promise). They cannot coexist with a `page.tsx` in the same folder. They return any `Response` — JSON, streams, files.

## 4. Actual EMS implementation
Every handler is wrapped by `protectedHandler` (`src/lib/server/handler.ts`): session → permission → (for mutations) same-origin check → `try/catch` mapping `ApiError` to status codes. Handlers **call Express** via the data-access layer; no business rule is duplicated.

| Route | Verbs | Purpose |
|---|---|---|
| `/api/employees` | GET | paged list for the **employee typeahead** (`EmployeePicker` → `useEmployeeSearch`: manager and department head) |
| `/api/employees/[id]` | GET · PUT · PATCH · DELETE | read/update/partial update (strict allow-listed fields)/deactivate (204) |
| `/api/employees/[id]/picture` | GET | **file response**: private image bytes with `Cache-Control: private` |
| `/api/leave/requests/[id]/documents/[docId]` | GET | **file download** (`attachment`, `nosniff`) |
| `/api/reports/[name]/csv` | GET | **CSV download**, name allow-listed |
| `/api/notifications` | GET · POST | list+unread for the bell; mark read |
| `/api/attendance/today`, `/api/leave/balances` | GET | client-island data (check-in card, leave-balance hint) |
| `/api/auth/session` | GET | non-sensitive session info for client code |
| `/api/auth/username-available` | GET | **public**, live check for registration |
| `/api/health` | GET | liveness + upstream status |
| `/api/revalidate` | POST | secret-protected on-demand cache revalidation |

Request/Response/NextRequest, JSON, status codes, headers, cookies, params, search params, streaming bodies (`new Response(upstream.body)`) and files are all demonstrated by these handlers.

## 5. Relevant file paths
- `src/lib/server/handler.ts`
- `src/app/api/employees/[id]/route.ts`
- `src/app/api/employees/[id]/picture/route.ts`
- `src/app/api/reports/[name]/csv/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/revalidate/route.ts`
- `src/app/api/health/route.ts`

## 6. Practical use case
The header bell polls `/api/notifications`; the avatar `<img>` hits `/api/employees/7/picture` — the browser can fetch both with its cookie while the token stays server-side.

## 7. Why the concept is used
Browser-callable endpoints are needed for things a Server Component cannot do (polling, downloads, `<img src>`, webhooks, third-party callers).

## 8. Advantages
- Standard Web APIs.
- Files and streams.
- Usable from non-React clients.

## 9. Limitations
- No built-in CSRF check (EMS adds an Origin check for mutating ones).
- Not cached by default; GET caching must be opted into.
- Do not call your own handlers from Server Components (call the data layer directly).

## 10. Common mistakes
- Calling a Route Handler from a Server Component (extra hop).
- Forgetting authorization because "the UI doesn’t show it".
- Returning backend 500 text to the client.

## 11. Interview-related considerations
- Route Handler vs Server Action?
- How do you stream a file?
- Are `GET` handlers cached?
