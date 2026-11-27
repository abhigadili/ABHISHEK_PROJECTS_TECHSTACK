import { route, ok, created, json, idOf } from '@/server/http/api';
import { hospitalService } from '@/server/services/hospital.service';

export const POST = route({}, async (c) => {
return created(await hospitalService.addDepartment(c.principal, idOf(c.params.id), await json(c.req)));
});
export const DELETE = route({}, async (c) => {
await hospitalService.removeDepartment(c.principal, idOf(c.req.nextUrl.searchParams.get("departmentId") ?? "")); return ok(null);
});
