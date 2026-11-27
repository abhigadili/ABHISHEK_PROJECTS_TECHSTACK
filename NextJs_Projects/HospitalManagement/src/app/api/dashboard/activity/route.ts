import { NextRequest } from 'next/server';
import { guard } from '@/lib/api/route-helpers';
import { getAppointmentStats, getBillingStats, getLabStats, getPeopleCounts } from '@/lib/dashboard/metrics';

/**
 * Streaming Response: Newline-delimited JSON. Each metric is flushed the moment its backend calls finish, so the client can render
 * figures progressively (progressive rendering) instead of waiting for the slowest service.
 */
export async function GET(req: NextRequest) {
  const g = await guard(); if ('response' in g) return g.response;
  const role = g.session.role;
  const enc = new TextEncoder();
  const tasks: Array<[string, () => Promise<unknown>]> = [['people', () => getPeopleCounts(role)], ['lab', () => getLabStats(role)], ['billing', () => getBillingStats(role)], ['appointments', async () => { const a = await getAppointmentStats(role); return a && { total: a.total, today: a.today, pending: a.pending, completed: a.completed }; }]];
  const stream = new ReadableStream({
    async start(controller) {
      await Promise.all(tasks.map(async ([name, fn]) => {
        if (req.signal.aborted) return;
        const value = await fn().catch(() => null);
        controller.enqueue(enc.encode(JSON.stringify({ name, value, at: Date.now() }) + '\n'));
      }));
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' } });
}
