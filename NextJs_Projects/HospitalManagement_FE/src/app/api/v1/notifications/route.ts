import { route, ok, query } from '@/server/http/api';
import { notificationService } from '@/server/services/notification.service';
import { z } from 'zod';

export const GET = route({ permission: 'notification:read' }, async (c) => {
const q = query(c.req, z.object({ unread: z.coerce.boolean().optional(), page: z.coerce.number().default(0), size: z.coerce.number().default(20) })); const r = await notificationService.list(c.principal, q); return ok({ items: r.items, unread: r.unread }, { page: q.page, size: q.size, total: r.total, totalPages: Math.ceil(r.total / q.size) });
});
export const POST = route({ permission: 'notification:read' }, async (c) => {
await notificationService.markAllRead(c.principal); return ok(null);
});
