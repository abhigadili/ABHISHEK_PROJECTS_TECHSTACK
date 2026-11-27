import { route, ok, json, idOf } from '@/server/http/api';
import { patientService } from '@/server/services/patient.service';

export const GET = route({}, async (c) => {
return ok(await patientService.get(c.principal, idOf(c.params.id)));
});
export const PUT = route({}, async (c) => {
await patientService.update(c.principal, idOf(c.params.id), await json(c.req)); return ok(null);
});
export const DELETE = route({}, async (c) => {
await patientService.remove(c.principal, idOf(c.params.id)); return ok(null);
});
