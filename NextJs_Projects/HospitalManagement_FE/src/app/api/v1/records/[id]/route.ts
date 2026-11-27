import { route, ok, idOf } from '@/server/http/api';
import { recordService } from '@/server/services/medical-record.service';

export const GET = route({}, async (c) => {
return ok(await recordService.get(c.principal, idOf(c.params.id)));
});
export const DELETE = route({}, async (c) => {
await recordService.remove(c.principal, idOf(c.params.id)); return ok(null);
});
