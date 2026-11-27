import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, isApiError } from './api-client';
import { checkPermission } from './permissions';
import type { Permission } from '@/constants/roles';
import type { SessionUser } from './session';

/** Uniform JSON error body for Route Handlers. 5xx internals were already logged by the API client; clients only get the safe message. */
export function errorResponse(e: unknown): NextResponse {
  if (isApiError(e)) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  console.error('[route] unexpected error', e);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 });
}

/**
 * CSRF defence for cookie-authenticated, state-changing Route Handlers: the cookies are SameSite=Lax (not sent on cross-site POSTs),
 * and we additionally require the `Origin` header — when present — to match this host (Server Actions get an equivalent check built in).
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: { code: 'CSRF', message: 'Cross-origin request rejected' } }, { status: 403 });
  return null;
}

type Ctx<P> = { params: Promise<P> };
/** Authentication + authorization wrapper: every protected handler goes through it (never rely on the proxy alone). */
export function protectedHandler<P = Record<string, never>>(
  opts: { permission?: Permission; mutating?: boolean },
  fn: (req: NextRequest, user: SessionUser, params: P) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    if (opts.mutating) { const bad = assertSameOrigin(req); if (bad) return bad; }
    const g = await checkPermission(opts.permission);
    if (!g.ok) return NextResponse.json({ error: { code: g.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: g.message } }, { status: g.status });
    try { return await fn(req, g.user, await ctx.params); } catch (e) { return errorResponse(e); }
  };
}
export { ApiError };
