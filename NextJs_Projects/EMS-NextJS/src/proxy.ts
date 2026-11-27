import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, expiredCookies, sessionCookies, type TokenPair } from '@/lib/server/cookies';
import { refreshTokens } from '@/lib/server/auth';

/**
 * Next.js 16 `proxy.ts` (the renamed `middleware.ts`). It runs BEFORE routes render and does only lightweight, UX-level work:
 *   1. redirect anonymous visitors of protected pages to /login (and answer 401 JSON for protected /api calls)
 *   2. redirect signed-in users away from /login, /register …
 *   3. silently renew the access token from the refresh cookie (Server Components cannot set cookies, the proxy can)
 * It is NOT the authorization layer: every Server Component, Server Action and Route Handler re-checks the session and the Express API
 * enforces roles. A bypassed proxy therefore grants nothing.
 */
const GUEST_ONLY = ['/login', '/register', '/forgot-password', '/reset-password'];
const PUBLIC = ['/', '/unauthorized', '/help', '/docs', '/learn', '/api/health', '/api/revalidate', '/api/auth/username-available', '/three', '/four'];
const isPublic = (p: string) => PUBLIC.some((x) => p === x || (x !== '/' && p.startsWith(`${x}/`))) || p.startsWith('/learn-');
const isGuest = (p: string) => GUEST_ONLY.some((x) => p === x);

/**
 * Backend refresh tokens ROTATE and re-use revokes the whole family, so parallel requests (prefetches!) must not each refresh with the
 * same token. This in-process map de-duplicates concurrent refreshes (best effort for one server instance; see docs/deployment.md for
 * the multi-instance caveat).
 */
const inflight = new Map<string, Promise<TokenPair | null>>();
function refreshOnce(rt: string): Promise<TokenPair | null> {
  let p = inflight.get(rt);
  if (!p) {
    p = refreshTokens(rt)
      .then((t) => t as TokenPair)
      .catch(() => null)
      .finally(() => setTimeout(() => inflight.delete(rt), 5000)); // keep the result briefly for requests that raced us
    inflight.set(rt, p);
  }
  return p;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const at = request.cookies.get(ACCESS_COOKIE)?.value;
  const rt = request.cookies.get(REFRESH_COOKIE)?.value;
  let renewed: TokenPair | null = null;
  let authed = !!at;

  if (!at && rt) {
    renewed = await refreshOnce(rt);
    authed = !!renewed;
  }

  if (!authed && !isPublic(pathname) && !isGuest(pathname)) {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'You are not signed in' } }, { status: 401 });
      if (rt) for (const c of expiredCookies()) res.cookies.set(c.name, c.value, c.options);
      return res;
    }
    const to = new URL('/login', request.url);
    to.searchParams.set('next', pathname + search);
    const res = NextResponse.redirect(to);
    if (rt) for (const c of expiredCookies()) res.cookies.set(c.name, c.value, c.options); // dead refresh token → clear
    return res;
  }

  if (authed && isGuest(pathname)) {
    const res = NextResponse.redirect(new URL('/dashboard', request.url));
    if (renewed) for (const c of sessionCookies(renewed)) res.cookies.set(c.name, c.value, c.options);
    return res;
  }

  if (renewed) {
    // make the NEW tokens visible to the Server Components rendering this very request, and persist them in the browser
    const headers = new Headers(request.headers);
    const jar = request.cookies.getAll().filter((c) => c.name !== ACCESS_COOKIE && c.name !== REFRESH_COOKIE).map((c) => `${c.name}=${c.value}`);
    const fresh = sessionCookies(renewed);
    headers.set('cookie', [...jar, ...fresh.map((c) => `${c.name}=${c.value}`)].join('; '));
    const res = NextResponse.next({ request: { headers } });
    for (const c of fresh) res.cookies.set(c.name, c.value, c.options);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|images|icons|assets).*)'],
};
