import { route, ok, json, idOf } from '@/server/http/api';
import { hospitalService } from '@/server/services/hospital.service';

export const GET = route({}, async (c) => {
return ok(await hospitalService.get(c.principal, idOf(c.params.id)));
});
export const PUT = route({}, async (c) => {
return ok(await hospitalService.update(c.principal, idOf(c.params.id), await json(c.req)));
});
export const DELETE = route({}, async (c) => {
await hospitalService.remove(c.principal, idOf(c.params.id)); return ok(null);
});
