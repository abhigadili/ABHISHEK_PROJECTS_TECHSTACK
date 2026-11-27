import { NextResponse, type NextRequest } from 'next/server';
import { AT_COOKIE, REFRESH_SKEW_SECONDS, ROLE_COOKIE, RT_COOKIE, RT_MAX_AGE } from '@/lib/auth/constants';
import { decodeJwt, isExpired, roleFromClaims } from '@/lib/auth/jwt';
import { can, type Permission } from '@/constants/permissions';
import type { TokenResponse } from '@/types';

/**
 * Proxy (Next.js 16 name for Middleware). Convenience layer ONLY - every Server Component, Server Action and Route Handler
 * re-checks authentication/authorization itself (lib/auth/session.ts), and the backend enforces roles again.
 *
 * Responsibilities: 1) redirect unauthenticated users to /login?next=  2) bounce signed-in users away from /login
 * 3) silent single-flight access-token refresh  4) coarse route-level access control  5) URL rewriting (/records -> /medical-records)
 * 6) request headers (x-request-id, x-pathname, x-client-country) and response headers.
 */
const BACKEND = (process.env.NODE_API_BASE_URL ?? 'http://localhost:30080').replace(/\/$/, '');

const PUBLIC_PREFIXES = ['/login', '/register', '/public', '/unauthorized', '/access-denied', '/api/auth', '/api/health', '/api/revalidate'];
const isPublic = (p: string) => p === '/' || PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

/** Coarse route -> permission table (conditional routing / route-level access control). */
const ROUTE_PERMISSIONS: Array<[string, Permission]> = [
  ['/admin', 'users:manage'],
  ['/billing', 'billing:read'],
  ['/pharmacy', 'pharmacy:access'],
  ['/laboratory', 'lab:read'],
  ['/medical-records', 'records:read'],
  ['/prescriptions', 'prescriptions:read'],
  ['/patients/register', 'patients:create'],
];

const inflight = new Map<string, Promise<TokenResponse | null>>();
function refreshOnce(rt: string) {
  let p = inflight.get(rt);
  if (!p) {
    p = fetch(`${BACKEND}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }), cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<TokenResponse>) : null))
      .catch(() => null)
      .finally(() => setTimeout(() => inflight.delete(rt), 5000));
    inflight.set(rt, p);
  }
  return p;
}

const secure = process.env.COOKIE_SECURE === 'true';
function applyTokens(res: NextResponse, t: TokenResponse) {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' };
  res.cookies.set(AT_COOKIE, t.accessToken, { ...base, maxAge: t.expiresInSeconds + 120 });
  res.cookies.set(RT_COOKIE, t.refreshToken, { ...base, maxAge: RT_MAX_AGE });
  res.cookies.set(ROLE_COOKIE, t.user.role, { ...base, httpOnly: false, maxAge: RT_MAX_AGE });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set('x-request-id', crypto.randomUUID());
  headers.set('x-pathname', pathname);
  const country = request.headers.get('x-vercel-ip-country'); // Geolocation: only populated behind Vercel/CDN geo headers
  if (country) headers.set('x-client-country', country);

  let at = request.cookies.get(AT_COOKIE)?.value;
  let claims = decodeJwt(at);
  const rt = request.cookies.get(RT_COOKIE)?.value;
  let refreshed: TokenResponse | null = null;

  // silent refresh (not for static asset / api/auth traffic)
  if (rt && isExpired(claims, REFRESH_SKEW_SECONDS) && !pathname.startsWith('/api/auth')) {
    refreshed = await refreshOnce(rt);
    if (refreshed) {
      at = refreshed.accessToken;
      claims = decodeJwt(at);
      request.cookies.set(AT_COOKIE, refreshed.accessToken);
      request.cookies.set(RT_COOKIE, refreshed.refreshToken);
      headers.set('cookie', request.cookies.toString());
    }
  }
  const authenticated = !!claims && !isExpired(claims);
  const role = roleFromClaims(claims);

  const finish = (res: NextResponse) => {
    if (refreshed) applyTokens(res, refreshed);
    res.headers.set('x-frame-options', 'SAMEORIGIN');
    res.headers.set('x-hms-proxy', '1');
    return res;
  };

  if (!authenticated && !isPublic(pathname)) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ status: 401, message: 'Authentication required' }, { status: 401 });
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    const res = NextResponse.redirect(url);
    if (rt) { res.cookies.delete(AT_COOKIE); res.cookies.delete(RT_COOKIE); res.cookies.delete(ROLE_COOKIE); }
    return res;
  }

  if (authenticated && (pathname === '/login' || pathname === '/register')) return finish(NextResponse.redirect(new URL('/dashboard', request.url)));

  // URL rewriting: friendly alias for the medical-records module
  if (pathname === '/records' || pathname.startsWith('/records/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/records/, '/medical-records');
    return finish(NextResponse.rewrite(url, { request: { headers } }));
  }

  // Route-level access control (additional layer; pages re-check on the server)
  if (authenticated) {
    for (const [prefix, perm] of ROUTE_PERMISSIONS) {
      if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && !can(role, perm)) return finish(NextResponse.redirect(new URL('/access-denied', request.url)));
    }
  }

  return finish(NextResponse.next({ request: { headers } }));
}

export const config = {
  // Matcher configuration: skip Next internals, static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|css|js|map|txt|xml)$).*)'],
};
