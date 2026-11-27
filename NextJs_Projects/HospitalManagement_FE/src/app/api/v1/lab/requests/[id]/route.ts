import { route, ok, json, idOf } from '@/server/http/api';
import { labService } from '@/server/services/laboratory.service';

export const GET = route({}, async (c) => {
return ok(await labService.get(c.principal, idOf(c.params.id)));
});
export const PATCH = route({}, async (c) => {
await labService.setStatus(c.principal, idOf(c.params.id), await json(c.req)); return ok(null);
});
