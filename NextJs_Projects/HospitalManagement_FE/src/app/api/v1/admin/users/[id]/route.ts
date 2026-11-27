import { route, ok, json, idOf } from '@/server/http/api';
import { adminService } from '@/server/services/admin.service';

export const PATCH = route({}, async (c) => {
return ok(await adminService.updateUser(c.principal, idOf(c.params.id), await json(c.req)));
});
export const DELETE = route({}, async (c) => {
await adminService.deleteUser(c.principal, idOf(c.params.id)); return ok(null);
});
