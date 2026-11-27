import { route, ok, json, idOf } from '@/server/http/api';
import { doctorService } from '@/server/services/doctor.service';

export const GET = route({}, async (c) => {
return ok(await doctorService.getAvailability(c.principal, idOf(c.params.id)));
});
export const PUT = route({}, async (c) => {
await doctorService.setAvailability(c.principal, idOf(c.params.id), await json(c.req)); return ok(null);
});
