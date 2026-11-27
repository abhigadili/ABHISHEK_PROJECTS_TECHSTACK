# 27. Server Actions vs Route Handlers

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Both run on the server. **Server Actions** are for *mutations triggered by your own React UI*; **Route Handlers** are for *HTTP endpoints* (reads from client code, files, webhooks, third-party callers).

## 2. Syntax
| | Server Action | Route Handler |
|---|---|---|
| Trigger | form / event handler | `fetch`, `<img>`, link, webhook |
| Verb | POST (internally) | any |
| Returns | serialisable value / redirect | any `Response` |
| CSRF | built-in Origin check | **you** add it |
| Cache integration | `updateTag`, `revalidatePath` | `revalidateTag(…,'max')` |
| Progressive enhancement | yes | n/a |

## 3. How Next.js implements it
Actions are RPC over POST with framework-managed encryption/IDs; handlers are plain endpoints you fully control.

## 4. Actual EMS implementation
Decision used in EMS (and why):

* **Mutations from forms** → Server Actions (employees, departments, leave, attendance, holidays, profile, notifications, users, auth).
* **Client-island reads/polling** → Route Handlers (`/api/attendance/today`, `/api/notifications`, `/api/leave/balances`, `/api/employees` typeahead).
* **Files** → Route Handlers (`picture`, leave documents, CSV).
* **Webhook** → Route Handler (`/api/revalidate`).
* **Public live check** → Route Handler (`/api/auth/username-available`).
* Both families call the **same data-access layer**; neither duplicates business logic. Mutating handlers add `assertSameOrigin`.

## 5. Relevant file paths
- `src/actions/`
- `src/app/api/`
- `src/lib/server/handler.ts`
- `docs/nextjs-concepts/13-route-handlers.md`
- `docs/nextjs-concepts/26-server-actions.md`

## 6. Practical use case
Mark-all-read is a Server Action (it refreshes the server-rendered list) *and* the bell badge is refreshed by a client fetch to a Route Handler — each tool where it fits.

## 7. Why the concept is used
Using the right primitive avoids reinventing CSRF/cache plumbing or exposing awkward endpoints.

## 8. Advantages
- Clear separation of UI-driven writes and HTTP endpoints.

## 9. Limitations
- Two mechanisms to learn and secure.

## 10. Common mistakes
- Using actions for reads or polling.
- Calling your own Route Handler from a Server Component.
- Forgetting CSRF/origin checks on mutating handlers.

## 11. Interview-related considerations
- When would you still need a Route Handler for a mutation? (non-browser callers, webhooks)
