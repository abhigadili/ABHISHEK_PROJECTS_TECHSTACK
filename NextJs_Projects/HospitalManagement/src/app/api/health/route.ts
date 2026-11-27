import { NextResponse } from 'next/server';
import { backendResponse } from '@/lib/api/backend';

/** Health of the Next.js app and its upstream gateway (public, never cached). */
export const dynamic = 'force-dynamic'; // Route Segment Config
export async function GET() {
  const t0 = Date.now();
  const up = await backendResponse('/gateway/ping', { auth: 'none', cache: 'no-store', timeoutMs: 3000 }).then((r) => r.ok).catch(() => false);
  return NextResponse.json({ app: 'ok', backend: up ? 'up' : 'down', latencyMs: Date.now() - t0, time: new Date().toISOString() }, { status: up ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
