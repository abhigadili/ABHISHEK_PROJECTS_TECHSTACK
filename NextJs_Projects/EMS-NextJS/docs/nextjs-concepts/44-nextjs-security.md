# 44. Next.js security

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Security in a server-rendered app means protecting **secrets, sessions, inputs, outputs and the server/client boundary**, in layers.

## 2. Syntax
```ts
import 'server-only';                                     // keep secrets server-side
export function assertSameOrigin(req: NextRequest) { … }   // CSRF for cookie-authenticated handlers
const parsed = schema.safeParse(input);                    // validate every untrusted input on the server
```

## 3. How Next.js implements it
Server Actions: automatic Origin-vs-Host check and encrypted, non-guessable action IDs — but they are public endpoints and **must authorise**. React escapes output by default (XSS). Cookies: HttpOnly/Secure/SameSite. `next.config.ts` can add security headers.

## 4. Actual EMS implementation
| Threat | Mitigation in EMS |
|---|---|
| Token theft via XSS | tokens only in **HttpOnly** cookies; nothing in `localStorage`; no `dangerouslySetInnerHTML` anywhere |
| CSRF | SameSite=Lax cookies + built-in Server Action Origin check + `assertSameOrigin` on mutating Route Handlers (unit-tested) |
| Broken access control | authorise in pages, actions and handlers (`requirePermission`/`secured`/`protectedHandler`) — the proxy is only UX; backend is authoritative |
| IDOR | ids validated; the backend scopes visibility (404/403 → `notFound`/`/unauthorized`) |
| Open redirect | `safeNext()` allows same-origin paths only |
| Injection / bad input | zod on every Server Action and handler input; strict allow-listed fields for PATCH; ids validated before reaching API paths |
| File upload abuse | type + size validated in the browser *and* in the action (`checkFile`); backend sniffs content; downloads are `attachment` + `nosniff`; Server Action body cap 6 MB |
| SSRF / path abuse | the API base URL is fixed server config; CSV report names and revalidate tags are **allow-lists** |
| Secret leakage | `server-only` modules, zod-validated env, no `NEXT_PUBLIC_` secrets; 5xx details never forwarded; logs omit tokens/bodies |
| Webhook abuse | `/api/revalidate` needs a secret header (constant-time compare) and only accepts known tags |
| Clickjacking / sniffing / referrer | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS |
| Private images in shared caches | `unoptimized` avatars via authenticated handler, `Cache-Control: private` |
| Indexing of private pages | `noindex` metadata + robots.txt + auth |
| Brute force | backend login limiter (10 / 15 min) |
| Dependency risk | `npm audit --omit=dev` → **0 vulnerabilities**. A high-severity advisory in zod 3.x (GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized collections) was fixed by upgrading to **zod 4**. Remaining advisories are in the **dev-only** test toolchain (Vitest/tinypool) and are not shipped. |

**Not implemented (stated honestly):** a Content-Security-Policy header (needs per-request nonces with Tailwind/Next inline styles — recommended next step, see best-practices doc); CSRF tokens beyond SameSite+Origin; multi-instance refresh coordination.

## 5. Relevant file paths
- `next.config.ts`
- `src/lib/server/handler.ts`
- `src/lib/server/env.ts`
- `src/lib/utils/safe-redirect.ts`
- `src/actions/_shared.ts`
- `src/app/api/revalidate/route.ts`
- `src/app/api/reports/[name]/csv/route.ts`
- `src/lib/server/cookies.ts`

## 6. Practical use case
A malicious site posts a form to `/api/employees/1` → blocked by SameSite and the Origin check; a forged action call without a session → `secured` returns 401-style state.

## 7. Why the concept is used
Defence in depth: any single control may fail.

## 8. Advantages
- Layered controls.
- Verified by tests.

## 9. Limitations
- No CSP yet.
- Proxy-level protections must never be the only ones.

## 10. Common mistakes
- Putting authorization only in the proxy.
- `NEXT_PUBLIC_` secrets.
- Trusting client validation.
- Allowing arbitrary backend paths through a BFF.

## 11. Interview-related considerations
- How are Server Actions secured?
- What is a CSRF and why SameSite helps?
- Why allow-lists for CSV names and tags?
