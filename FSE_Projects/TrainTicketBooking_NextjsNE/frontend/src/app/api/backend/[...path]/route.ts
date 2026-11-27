import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { AT_COOKIE, RT_COOKIE } from '@/lib/constants';
import { API_ORIGIN, refreshOnce } from '@/lib/server/refresh';
import { writeSession, clearSession } from '@/lib/server/session';

/**
 * Backend-for-Frontend pass-through. Browser code (Axios + TanStack Query) calls `/api/backend/<express path>`;
 * this handler adds the Bearer token from the HttpOnly cookie, forwards to Express and returns Express' JSON unchanged.
 * It contains NO business logic. If Express answers 401 it refreshes the session once (single-flight) and retries.
 * `/auth/*` is deliberately not reachable here - authentication goes through Server Actions and /api/session.
 */
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: NextRequest, path: string[], token: string | undefined) {
  const url = `${API_ORIGIN}/api/${path.join('/')}${req.nextUrl.search}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const hasBody = !['GET', 'HEAD'].includes(req.method); const body = hasBody ? await req.text() : undefined;
  if (hasBody) headers['content-type'] = req.headers.get('content-type') ?? 'application/json';
  return fetch(url, { method: req.method, headers, body, cache: 'no-store' });
}

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path[0] === 'auth') return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Use the session endpoints for authentication.' } }, { status: 404 });
  const jar = await cookies(); let at = jar.get(AT_COOKIE)?.value; const rt = jar.get(RT_COOKIE)?.value;
  let upstream = await forward(req, path, at);
  let refreshed: Awaited<ReturnType<typeof refreshOnce>> = null;
  if (upstream.status === 401 && rt) {
    refreshed = await refreshOnce(rt);
    if (refreshed) { at = refreshed.accessToken; upstream = await forward(req, path, at); }
  }
  const res = new NextResponse(await upstream.text(), { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' } });
  if (refreshed) writeSession(res.cookies, refreshed);
  else if (upstream.status === 401) clearSession(res.cookies);
  return res;
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
