# 37. Cookies and headers

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
`cookies()` and `headers()` (from `next/headers`) read the incoming request in Server Components, actions and handlers; `cookies().set` writes `Set-Cookie` in Server Actions and Route Handlers. Both are **async** in this version and are runtime APIs (dynamic rendering).

## 2. Syntax
```ts
const jar = await cookies(); jar.set('ems_at', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge });
const token = (await cookies()).get('ems_at')?.value;
```

## 3. How Next.js implements it
Server Components cannot set cookies (streaming has begun) — that is why refresh lives in `proxy.ts`. Reading cookies opts the component into per-request rendering.

## 4. Actual EMS implementation
* `ems_at` (access, TTL − 60 s) and `ems_rt` (refresh, 7 d): HttpOnly, SameSite=Lax, `Secure` in production, path `/` (`lib/server/cookies.ts`).
* Read in `api-client.ts › authHeader` for every authenticated server call; written by `loginAction` (sign-in) and refreshed by `proxy.ts`; cleared by `logoutAction`, `changePasswordAction` and by the proxy when a refresh token is dead. Registration does **not** sign the user in — it redirects to `/login`.
* **Response headers** set globally in `next.config.ts › headers()` (security headers) and per-response in handlers: `Cache-Control: private, no-store` (JSON), `private, max-age=120` (pictures), `Content-Disposition: attachment` + `nosniff` (downloads), `Content-Type: text/csv`.
* **Request headers**: the proxy forwards a modified `cookie` header; `assertSameOrigin` reads `Origin`/`Host`.

## 5. Relevant file paths
- `src/lib/server/cookies.ts`
- `src/lib/server/api-client.ts`
- `src/proxy.ts`
- `src/app/api/employees/[id]/picture/route.ts`
- `src/app/api/reports/[name]/csv/route.ts`
- `next.config.ts`
- `tests/session.test.ts`

## 6. Practical use case
The browser never sees a token in JavaScript; devtools show the cookies as HttpOnly.

## 7. Why the concept is used
Secure session storage and explicit cacheability of responses.

## 8. Advantages
- XSS cannot steal tokens.
- Headers are explicit.

## 9. Limitations
- Cookies are sent with every request to the origin (size/perf).
- `SameSite=Lax` alone doesn’t stop same-site attacks → Origin check on mutating handlers.

## 10. Common mistakes
- Setting cookies in a Server Component.
- Forgetting `Secure` in production.
- Caching responses that depend on cookies in a shared cache.

## 11. Interview-related considerations
- HttpOnly vs Secure vs SameSite?
- Why are `cookies()`/`headers()` async now?
