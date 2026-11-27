import { route, ok, json, idOf } from '@/server/http/api';
import { doctorService } from '@/server/services/doctor.service';

export const GET = route({}, async (c) => {
return ok(await doctorService.get(c.principal, idOf(c.params.id)));
});
export const PATCH = route({}, async (c) => {
return ok(await doctorService.updateProfile(c.principal, idOf(c.params.id), await json(c.req)));
});
export const DELETE = route({}, async (c) => {
await doctorService.deactivate(c.principal, idOf(c.params.id)); return ok(null);
});
