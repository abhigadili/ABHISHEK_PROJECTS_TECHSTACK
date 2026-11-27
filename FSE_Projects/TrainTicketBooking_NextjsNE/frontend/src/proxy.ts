import { NextResponse, type NextRequest } from 'next/server';
import { AT_COOKIE, RT_COOKIE } from '@/lib/constants';
import { jwtExp, refreshOnce } from '@/lib/server/refresh';
import { clearSession, writeSession } from '@/lib/server/session';

/**
 * Next 16 "proxy" (formerly middleware). Runs before every matched request:
 *  1. silent session refresh - if the access token is missing/expiring but a refresh token exists, rotate it (single-flight) and
 *     forward the fresh cookies to the Server Components rendering THIS request;
 *  2. coarse navigation guards - signed-out users go to /login?next=..., signed-in users skip /login (role gating is done by the layouts via forbidden());
 *  3. request header `x-pathname` for server-side redirects.
 * This is a convenience layer only: pages, actions and Express re-check every permission.
 */
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];
const PROTECTED = ['/account', '/book', '/admin'];
const startsWith = (p: string, list: string[]) => list.some((x) => p === x || p.startsWith(`${x}/`));

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  let at = req.cookies.get(AT_COOKIE)?.value; const rt = req.cookies.get(RT_COOKIE)?.value;
  let refreshed: Awaited<ReturnType<typeof refreshOnce>> = null; let dead = false;

  const expiring = !at || jwtExp(at) - Date.now() / 1000 < 20;
  if (expiring && rt) {
    refreshed = await refreshOnce(rt);
    if (refreshed) { at = refreshed.accessToken; } else { at = undefined; dead = true; }
  }
  const signedIn = !!at;

  let response: NextResponse;
  if (!signedIn && startsWith(pathname, PROTECTED)) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = `?next=${encodeURIComponent(pathname + search)}${dead ? '&reason=expired' : ''}`; response = NextResponse.redirect(url);
  } else if (signedIn && startsWith(pathname, AUTH_PAGES) && pathname !== '/reset-password') {
    const next = req.nextUrl.searchParams.get('next'); const url = req.nextUrl.clone(); url.search = ''; url.pathname = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'; response = NextResponse.redirect(url);
  } else {
    const headers = new Headers(req.headers); headers.set('x-pathname', pathname + search);
    if (refreshed) { const jar = new Map(req.cookies.getAll().map((c) => [c.name, c.value])); jar.set(AT_COOKIE, refreshed.accessToken); jar.set(RT_COOKIE, refreshed.refreshToken); headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; ')); }
    response = NextResponse.next({ request: { headers } });
  }
  if (refreshed) writeSession(response.cookies, refreshed); else if (dead) clearSession(response.cookies);
  response.headers.set('x-frame-options', 'SAMEORIGIN');
  return response;
}

// Matcher: skip static assets, images, the BFF/session/revalidate handlers (they manage their own auth) and metadata files.
export const config = { matcher: ['/((?!_next/static|_next/image|api/|favicon|images/|robots.txt|sitemap.xml).*)'] };
