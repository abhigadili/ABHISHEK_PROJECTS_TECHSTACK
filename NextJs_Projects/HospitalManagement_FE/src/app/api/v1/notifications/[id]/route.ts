import { route, ok, idOf } from '@/server/http/api';
import { notificationService } from '@/server/services/notification.service';

export const PATCH = route({ permission: 'notification:read' }, async (c) => {
await notificationService.markRead(c.principal, idOf(c.params.id)); return ok(null);
});
