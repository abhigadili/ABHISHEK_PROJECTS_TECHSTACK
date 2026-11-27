# 42. Error handling

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Errors fall into *expected* (validation, 404, 403, backend 4xx — handled as data/UI) and *unexpected* (bugs, outages — caught by error boundaries). Next.js gives file conventions for both: `error.tsx`, `global-error.tsx`, `not-found.tsx`, plus `notFound()`/`redirect()` control flow.

## 2. Syntax
```tsx
'use client'; export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { … }
try { … } catch (e) { unstable_rethrow(e); return fromApiError(e); }       // keep redirect()/notFound() flowing
```

## 3. How Next.js implements it
`error.tsx` wraps its segment in a React error boundary (a Client Component) and receives `reset()`; it does not catch errors thrown by its *own* layout (use the parent or `global-error.tsx`). In production only a `digest` reaches the browser; the message is logged on the server. Navigation control-flow (`redirect`, `notFound`) is implemented with thrown errors — never swallow them.

## 4. Actual EMS implementation
* **Boundaries:** `app/error.tsx` (root segment), `app/global-error.tsx` (root layout failures; renders its own `<html>`), slot-level `dashboard/@charts/error.tsx` (isolates a failing widget).
* **Backend errors:** the `ApiError` model (doc 25): 4xx → user-readable message + field details; 5xx → generic safe message, internals logged with `requestId`; network/timeout → 503 "temporarily unavailable". A backend outage never looks like "signed out" (`getSession` rethrows non-401/403).
* **Forms:** validation errors come back as `fieldErrors` and render beside the inputs; unexpected failures become one generic alert (`fromApiError`).
* **Route Handlers:** uniform JSON `{ error: { code, message, details } }` with proper status (`errorResponse`).
* **Authorization failures:** `/unauthorized` page (403-style) distinct from not-found.
* **Never leaked:** SQL/stack messages (unit-tested in `tests/api-client.test.ts`, `tests/handler.test.ts`, `tests/actions.test.ts`).

## 5. Relevant file paths
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/(dashboard)/dashboard/@charts/error.tsx`
- `src/app/(dashboard)/unauthorized/page.tsx`
- `src/lib/server/api-client.ts`
- `src/lib/server/handler.ts`
- `src/actions/_shared.ts`

## 6. Practical use case
If Express is down, pages show a "service temporarily unavailable" message with a retry — not a blank screen, not a stack trace, and not a surprise logout.

## 7. Why the concept is used
Predictable, safe failure modes.

## 8. Advantages
- Isolated failure domains.
- No information leakage.

## 9. Limitations
- Error boundaries do not catch event-handler or async-after-render errors (handle those explicitly).
- A late `notFound()` after streaming starts can’t change the HTTP status (rendering doc).

## 10. Common mistakes
- Wrapping `redirect()` in try/catch (it throws).
- Showing raw `error.message` in production.
- Treating a 5xx as "logged out".

## 11. Interview-related considerations
- Where does `error.tsx` not catch? (its own layout)
- What is `digest`?
