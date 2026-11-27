import { route, ok, json, idOf } from '@/server/http/api';
import { appointmentService } from '@/server/services/appointment.service';

export const POST = route({}, async (c) => {
return ok(await appointmentService.reschedule(c.principal, idOf(c.params.id), await json(c.req)));
});
