# 36. Middleware and proxy (`proxy.ts`)

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Code that runs **before a request reaches a route**. In Next.js 16 the file is called **`proxy.ts`** (the renamed `middleware.ts`; the old name is deprecated).

## 2. Syntax
```ts
// src/proxy.ts
export async function proxy(request: NextRequest) { … return NextResponse.redirect(url) | NextResponse.next({ request: { headers } }); }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|images|icons|assets).*)'] };
```

## 3. How Next.js implements it
It can redirect, rewrite, set cookies/headers and continue the request with *modified request headers*. It should stay light: no heavy data access, and it must not rely on shared in-memory state for correctness.

## 4. Actual EMS implementation
`src/proxy.ts` performs: (1) anonymous → `/login?next=…` (and `401` JSON for protected `/api/*`); (2) signed-in → away from guest pages; (3) **silent token refresh** with the new cookies written to the response *and* injected into the request’s `cookie` header so Server Components in the same request see them; (4) clearing a dead refresh cookie. The in-process `Map` that de-duplicates concurrent refreshes is **best effort** (documented) — correctness never depends on it because the backend’s family-revocation is the backstop. The proxy is **not** the authorization layer (doc 35).

## 5. Relevant file paths
- `src/proxy.ts`
- `src/lib/server/cookies.ts`
- `tests/proxy.test.ts`

## 6. Practical use case
Ten parallel prefetches on an expired access token trigger exactly **one** `/auth/refresh` (unit-tested).

## 7. Why the concept is used
Cheap, early UX routing and the only place that can both read the request and set cookies before rendering.

## 8. Advantages
- Runs before rendering.
- Can fix up cookies for the same request.

## 9. Limitations
- Not a security boundary alone.
- Per-instance memory.
- Runs on every matched request — keep it fast.

## 10. Common mistakes
- Using it for authorization only.
- Doing database/API-heavy work.
- Using the deprecated `middleware.ts` name.

## 11. Interview-related considerations
- middleware vs proxy in Next 16?
- Why modify the request’s cookie header on refresh?
