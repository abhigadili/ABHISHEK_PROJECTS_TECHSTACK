import { route, created, paged, json, query } from '@/server/http/api';
import { adminService } from '@/server/services/admin.service';
import { userQuery } from '@/lib/validations/admin';

export const GET = route({}, async (c) => {
const q = query(c.req, userQuery); const r = await adminService.listUsers(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await adminService.createUser(c.principal, await json(c.req)));
});
