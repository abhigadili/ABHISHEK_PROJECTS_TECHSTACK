import { route, ok, json } from '@/server/http/api';
import { adminService } from '@/server/services/admin.service';

export const PUT = route({}, async (c) => {
await adminService.setRolePermissions(c.principal, c.params.key, await json(c.req)); return ok(null);
});
