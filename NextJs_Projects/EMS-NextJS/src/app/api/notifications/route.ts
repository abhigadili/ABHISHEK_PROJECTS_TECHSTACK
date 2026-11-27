import { NextResponse } from 'next/server';
import { z } from 'zod';
import { protectedHandler } from '@/lib/server/handler';
import { listNotifications, markRead, unreadCount } from '@/lib/server/notifications';
import { int } from '@/lib/utils/search-params';

/** GET /api/notifications?limit= → { items, unread } — polled by the header bell (client). Parallel upstream calls, never cached. */
export const GET = protectedHandler({}, async (req) => {
  const limit = int(req.nextUrl.searchParams.get('limit') ?? undefined, 8, 1, 50);
  const [list, unread] = await Promise.all([listNotifications({ limit }), unreadCount()]);
  return NextResponse.json({ items: list.items, unread }, { headers: { 'Cache-Control': 'private, no-store' } });
});

/** POST /api/notifications { ids?: number[] } — mark some (or ALL when omitted) as read. */
export const POST = protectedHandler({ mutating: true }, async (req) => {
  const body = z.object({ ids: z.array(z.number().int().positive()).max(200).optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } }, { status: 400 });
  await markRead(body.data.ids);
  return NextResponse.json({ ok: true });
});
