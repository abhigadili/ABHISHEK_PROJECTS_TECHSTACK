import { NextRequest, NextResponse } from 'next/server';
import { backendResponse } from '@/lib/api/backend';
import { errorResponse, guard } from '@/lib/api/route-helpers';

/**
 * Authenticated BFF pass-through used by every browser-side Axios / TanStack Query call.
 * Justification (not a copy of the backend): the access token lives in an HttpOnly cookie, so the browser cannot call the gateway
 * itself. This single handler attaches the Bearer token, restricts the reachable prefixes and streams the response body back
 * (JSON, PDF/PNG attachments...). No business logic lives here - the Node.js services remain the source of truth.
 */
const ALLOWED = new Set(['auth', 'patients', 'doctors', 'appointments', 'hospitals', 'departments', 'records', 'prescriptions', 'lab', 'bills', 'payments', 'pharmacy', 'notifications']);

async function forward(req: NextRequest, ctx: RouteContext<'/api/backend/[...path]'>) {
  const g = await guard();
  if ('response' in g) return g.response;
  const { path } = await ctx.params;
  if (!ALLOWED.has(path[0]) || (path[0] === 'auth' && path[1] !== 'me')) return NextResponse.json({ status: 404, message: 'Not found' }, { status: 404 });
  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const contentType = req.headers.get('content-type') ?? '';
    let body: unknown;
    if (hasBody) body = contentType.includes('multipart/form-data') ? await req.formData() : await req.json().catch(() => undefined);
    const query = Object.fromEntries(req.nextUrl.searchParams);
    const res = await backendResponse(`/api/${path.join('/')}`, { method: req.method as 'GET', query, body, cache: 'no-store', auth: 'session' });
    const headers = new Headers();
    for (const h of ['content-type', 'content-disposition', 'content-length']) { const v = res.headers.get(h); if (v) headers.set(h, v); }
    headers.set('Cache-Control', 'private, no-store');
    return new NextResponse(res.status === 204 ? null : res.body, { status: res.status, headers });
  } catch (e) { return errorResponse(e); }
}
export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
