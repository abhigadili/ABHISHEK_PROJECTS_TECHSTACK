import { route, ok, json } from '@/server/http/api';
import { notificationService } from '@/server/services/notification.service';
import { notificationPrefSchema } from '@/lib/validations/admin';

export const GET = route({ permission: 'notification:read' }, async (c) => {
return ok(await notificationService.getPreferences(c.principal));
});
export const PUT = route({ permission: 'notification:read' }, async (c) => {
return ok(await notificationService.setPreferences(c.principal, notificationPrefSchema.parse(await json(c.req))));
});
