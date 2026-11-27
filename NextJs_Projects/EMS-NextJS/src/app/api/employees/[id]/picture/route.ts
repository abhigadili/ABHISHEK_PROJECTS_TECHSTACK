import { protectedHandler } from '@/lib/server/handler';
import { getPicture } from '@/lib/server/employees';
import { ApiError } from '@/lib/server/api-client';

/**
 * GET /api/employees/:id/picture — FILE RESPONSE. The backend's picture endpoint needs a Bearer token the browser doesn't have (it is in
 * an HttpOnly cookie), so this handler streams the bytes through with the right headers. `private` prevents shared caches/CDNs from
 * storing someone's photo; the short max-age still spares the backend on repeated renders in the same browser.
 */
export const GET = protectedHandler<{ id: string }>({}, async (_req, _u, p) => {
  const id = Number(p.id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'BAD_REQUEST', 'Invalid employee id');
  const upstream = await getPicture(id);
  const type = upstream.headers.get('content-type') ?? 'application/octet-stream';
  if (!type.startsWith('image/')) throw new ApiError(502, 'INVALID_RESPONSE', 'Unexpected response from the service');
  return new Response(upstream.body, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=120', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
});
