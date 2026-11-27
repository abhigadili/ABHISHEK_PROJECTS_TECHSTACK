import { NextResponse, type NextRequest } from 'next/server';

// First line of defence only: send visitors without a session cookie to /login.
// The API enforces the real permissions, and the layouts re-check the user's role.
export function proxy(req: NextRequest) {
  const has = req.cookies.has(process.env.SESSION_COOKIE_NAME ?? 'lms_session');
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = '/login'; url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/member/:path*', '/staff/:path*', '/receipt/:path*'] };
