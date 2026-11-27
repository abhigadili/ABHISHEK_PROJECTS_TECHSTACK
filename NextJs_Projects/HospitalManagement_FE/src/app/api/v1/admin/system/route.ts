import { route, ok } from '@/server/http/api';
import { adminService } from '@/server/services/admin.service';

export const GET = route({}, async (c) => {
return ok(await adminService.systemConfig(c.principal));
});
