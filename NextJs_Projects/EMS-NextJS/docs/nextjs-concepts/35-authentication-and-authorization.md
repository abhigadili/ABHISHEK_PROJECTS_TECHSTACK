# 35. Authentication and authorization

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
**Authentication** = who you are (login, session). **Authorization** = what you may do (roles/permissions). In a server-rendered app both must be enforced **on the server, at every entry point** — hiding a button or redirecting in a proxy is not security.

## 2. Syntax
```ts
const user = await requireSession();                    // redirect('/login') when signed out
await requirePermission('employee:manage');             // redirect('/unauthorized') when forbidden
return secured('department:manage', async (user) => …); // Server Action gate
export const GET = protectedHandler({ permission: 'reports:view' }, async (req, user) => …);
```

## 3. How Next.js implements it
The Express API issues JWTs in the JSON body. Next.js stores them in **HttpOnly cookies** and attaches `Authorization: Bearer` on server calls. `proxy.ts` handles redirects and silent refresh; pages, actions and handlers re-check.

## 4. Actual EMS implementation
**Authentication flow:** login (username *or* email) → `loginAction` → cookies → redirect to a *safe* `?next=`; registration (public `/register`); forgot/reset password; change password (clears session — backend revokes all sessions); logout (`POST /auth/logout` + clear cookies). **Session restoration:** `getSession()` from the cookie on every request; silent refresh in `proxy.ts` with single-flight de-duplication; a dead refresh token is cleared and the user goes to `/login`.

**Authorization (defence in depth):**
1. `proxy.ts` — UX redirect for anonymous users (not a security boundary).
2. Server Components — `requireSession`/`requirePermission`; role-gated markup decided on the server; per-resource checks by the backend (404/403 → `notFound`/`/unauthorized`).
3. Server Actions — `secured(permission, …)`.
4. Route Handlers — `protectedHandler({ permission, mutating })`.
5. Express — the final authority (managers see their subtree, compensation only for admin/self).

**Roles:** SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE with the map in `constants/roles.ts`. Examples: only HR creates employees (`/employees/new` → `/unauthorized` for others), only managers see approvals, only SUPER_ADMIN changes roles, compensation hidden from non-admins.

**Security details worth noting:** open-redirect protection (`safeNext`), password policy enforced in zod *and* by the backend, a failed login shows one generic message (field-level hints are dropped so the response never says which half was wrong), tokens never in `localStorage`, `AuthProvider` receives display fields only.

## 5. Relevant file paths
- `src/actions/auth.ts`
- `src/lib/server/session.ts`
- `src/lib/server/permissions.ts`
- `src/lib/server/handler.ts`
- `src/lib/server/cookies.ts`
- `src/constants/roles.ts`
- `src/proxy.ts`
- `src/app/(auth)/login/page.tsx`
- `src/contexts/AuthContext.tsx`

## 6. Practical use case
An EMPLOYEE who guesses `/users` is sent to `/unauthorized`; the same user calling `POST /api/employees/9` directly gets 403 JSON; and a forged Server Action call fails the `secured` guard.

## 7. Why the concept is used
Security must hold even when the UI is bypassed.

## 8. Advantages
- Defence in depth.
- Tokens unreachable by XSS (HttpOnly).
- One guard vocabulary across pages/actions/handlers.

## 9. Limitations
- The UI permission map duplicates the backend’s rules (kept in sync by tests of the map, not by sharing code).
- Refresh single-flight is per instance (see deployment doc).

## 10. Common mistakes
- Checking authorization only in the proxy/middleware.
- Storing JWTs in localStorage.
- Trusting hidden form fields (ids, roles) — always re-validate server-side.

## 11. Interview-related considerations
- Why HttpOnly cookies over localStorage?
- Why is proxy-only protection insufficient? (CVE class: middleware bypass)
- Authentication vs authorization?
