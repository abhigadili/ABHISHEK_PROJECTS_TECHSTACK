/**
 * Next.js Middleware — cricket-universe-explorer
 *
 * ─── WHY middleware.ts MUST LIVE AT THE PROJECT ROOT (not inside src/) ───────
 * Next.js resolves middleware from the project root by convention. When you use
 * a `src/` directory layout, Next.js still expects the file at `src/middleware.ts`
 * (one level inside src), NOT at the repo root. If you put it at the very root
 * alongside next.config.ts, Next.js will NOT pick it up when `src/` exists.
 * Rule of thumb: middleware.ts lives at the same level as your `app/` folder —
 * which, in a src/ layout, means src/middleware.ts. In a non-src layout it would
 * be in the project root next to the `app/` directory.
 *
 * ─── INTERVIEW TIP: matcher config vs manual path check ──────────────────────
 * Two ways to limit which routes run middleware:
 *
 * 1. `export const config = { matcher: [...] }` (used here)
 *    ✅ Evaluated at build time — Next.js compiles the patterns to a fast trie.
 *    ✅ Next.js skips the middleware function entirely for non-matching paths.
 *    ✅ Best for performance; preferred for most use-cases.
 *
 * 2. Manual check inside the middleware function body:
 *    if (!request.nextUrl.pathname.startsWith('/dashboard')) return NextResponse.next()
 *    ❌ The middleware function still executes for every request.
 *    ✅ Useful when the matching logic is dynamic (e.g., read from a DB flag).
 *
 * ─── WHY USE MIDDLEWARE INSTEAD OF CHECKING AUTH IN EACH PAGE ────────────────
 * • Single source of truth: one place for auth logic, not duplicated in 20 pages.
 * • Runs before rendering: the user never sees a flash of protected content.
 * • Handles redirect before the React tree is even evaluated — lower TTFB.
 * • Pages (both Server and Client Components) only need to focus on UI concerns.
 *
 * ─── PERFORMANCE TIP: EDGE RUNTIME ──────────────────────────────────────────
 * Middleware runs on the Edge Runtime (V8 isolates, not Node.js). This means:
 * • Cold-start latency is measured in milliseconds, not seconds.
 * • Runs geographically close to the user (CDN edge nodes).
 * • Tradeoff: no Node.js APIs (fs, net, etc.) and limited npm ecosystem.
 * • Keep middleware lean — avoid heavy computation or large imports.
 *
 * ─── MIDDLEWARE vs LAYOUT-LEVEL AUTH ────────────────────────────────────────
 * Use MIDDLEWARE when:
 *   • You need to redirect before the page renders (avoid UI flash).
 *   • Auth logic is uniform across a route group (e.g., all /dashboard/* routes).
 *   • You want to protect API routes.
 *
 * Use LAYOUT-LEVEL AUTH (e.g., in layout.tsx with server-side session checks) when:
 *   • You need access to the full Node.js runtime or database.
 *   • Auth depends on complex server-side state beyond a cookie value.
 *   • You want to render a loading skeleton while auth resolves (App Router patterns).
 *
 * In production you often use BOTH: middleware for the fast early redirect, and
 * layout/page level for fine-grained role checks.
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Constants ───────────────────────────────────────────────────────────────

/** The name of the HttpOnly auth cookie we set on login. */
const AUTH_COOKIE_NAME = 'auth-token';

/** Routes that require the user to be authenticated. */
const PROTECTED_PATHS = ['/dashboard', '/profile'];

// ─── Middleware Function ──────────────────────────────────────────────────────

/**
 * Next.js middleware — executes on every request matched by `config.matcher`.
 *
 * Responsibilities (in order):
 *  1. Log the incoming request for observability.
 *  2. Generate and attach a unique request ID for distributed tracing.
 *  3. Attach custom application-level headers.
 *  4. Guard protected routes — redirect unauthenticated users to /login.
 */
export function middleware(request: NextRequest): NextResponse {
  const { method, nextUrl } = request;
  const pathname = nextUrl.pathname;

  // ── 1. Logging ─────────────────────────────────────────────────────────────
  // In production you'd ship logs to a service (Datadog, Axiom, etc.).
  // console.log here because Edge Runtime doesn't support Node's `winston`.
  console.log(
    `[Middleware] ${new Date().toISOString()} | ${method} ${pathname}`
  );

  // ── 2. Request ID Tracking ─────────────────────────────────────────────────
  // crypto.randomUUID() is available natively on the Edge Runtime (Web Crypto API).
  // Attach it to the forwarded request so API route handlers can log with the
  // same ID, enabling end-to-end request tracing across logs.
  const requestId = crypto.randomUUID();

  // ── 3. Cookie Handling ────────────────────────────────────────────────────
  // NextRequest.cookies gives a typed cookie jar. We read the auth-token cookie
  // to decide whether the user is authenticated before any page rendering occurs.
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(authToken);

  // ── 4. Protected Route Guard ──────────────────────────────────────────────
  // Check if the current pathname starts with any protected path segment.
  // Using startsWith rather than exact match so /dashboard/settings is also guarded.
  const isProtectedRoute = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedRoute && !isAuthenticated) {
    // Build the redirect URL, preserving the original destination so the login
    // page can redirect the user back after a successful login.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);

    console.log(
      `[Middleware] Unauthenticated access to ${pathname} — redirecting to /login`
    );

    // NextResponse.redirect sends a 307 Temporary Redirect by default.
    // Use { status: 308 } for permanent redirects (e.g. renamed routes).
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Build the response with custom headers ─────────────────────────────
  // NextResponse.next() tells Next.js to continue with the normal rendering
  // pipeline. We clone the request headers so the downstream route/page also
  // has access to X-Request-Id for server-side logging.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Attach headers to the *response* so the browser (and CDN) can read them.
  // X-Request-Id: useful for correlating browser network logs with server logs.
  response.headers.set('x-request-id', requestId);

  // X-App-Name / X-App-Version: consumed by monitoring dashboards and canary
  // release tooling to know which app version served the response.
  response.headers.set(
    'x-app-name',
    process.env.NEXT_PUBLIC_APP_NAME ?? 'Cricket Universe Explorer'
  );
  response.headers.set(
    'x-app-version',
    process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
  );

  return response;
}

// ─── Route Matcher ────────────────────────────────────────────────────────────
/**
 * The `matcher` array tells Next.js which paths should invoke this middleware.
 * Paths NOT in this list skip middleware entirely — zero overhead on static
 * assets, _next internals, and unmatched public pages.
 *
 * Pattern syntax:
 *   '/dashboard/:path*'  — matches /dashboard AND /dashboard/anything/nested
 *   '/api/:path*'        — matches all API routes so they get the request-id header
 *
 * Interview tip: You can also use a negative lookahead regex to exclude paths:
 *   { source: '/((?!_next/static|favicon.ico).*)' }
 */
export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/api/:path*'],
};
