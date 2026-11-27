import { NextResponse } from 'next/server';
import { API_ORIGIN } from '@/lib/server/refresh';
/** GET /api/health - frontend liveness plus a reachability probe of the Express API (aggregates one upstream call). */
export const dynamic = 'force-dynamic';
export async function GET() {
  const upstream = await fetch(`${API_ORIGIN}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
  return NextResponse.json({ frontend: 'ok', backend: upstream ? 'ok' : 'unreachable', time: new Date().toISOString() }, { status: upstream ? 200 : 503 });
}
