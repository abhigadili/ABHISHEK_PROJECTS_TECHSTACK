import { route, ok, json, idOf } from '@/server/http/api';
import { appointmentService } from '@/server/services/appointment.service';

export const GET = route({}, async (c) => {
return ok(await appointmentService.get(c.principal, idOf(c.params.id)));
});
export const PATCH = route({}, async (c) => {
return ok(await appointmentService.setStatus(c.principal, idOf(c.params.id), await json(c.req)));
});
