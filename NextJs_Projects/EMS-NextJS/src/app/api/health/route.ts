import { env } from '@/lib/server/env';

/** GET /api/health — liveness + upstream check for load balancers. Prerendered-free (it calls the API), never cached, no secrets in the body. */
export async function GET() {
  let upstream: 'up' | 'down' = 'down';
  try {
    const base = env.EMS_API_URL.replace(/\/api\/v\d+\/?$/, '');
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
    upstream = r.ok ? 'up' : 'down';
  } catch { /* upstream unreachable */ }
  return Response.json({ status: upstream === 'up' ? 'ok' : 'degraded', upstream }, { status: upstream === 'up' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
