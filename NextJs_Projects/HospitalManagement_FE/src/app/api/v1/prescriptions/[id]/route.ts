import { route, ok, json, idOf } from '@/server/http/api';
import { prescriptionService } from '@/server/services/prescription.service';

export const GET = route({}, async (c) => {
return ok(await prescriptionService.get(c.principal, idOf(c.params.id)));
});
export const PUT = route({}, async (c) => {
await prescriptionService.update(c.principal, idOf(c.params.id), await json(c.req)); return ok(null);
});
export const DELETE = route({}, async (c) => {
await prescriptionService.cancel(c.principal, idOf(c.params.id)); return ok(null);
});
