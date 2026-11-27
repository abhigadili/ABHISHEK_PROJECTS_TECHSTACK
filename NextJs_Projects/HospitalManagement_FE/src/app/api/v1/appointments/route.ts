import { route, created, paged, json, query } from '@/server/http/api';
import { appointmentService } from '@/server/services/appointment.service';
import { appointmentQuery } from '@/lib/validations/appointment';

export const GET = route({}, async (c) => {
const q = query(c.req, appointmentQuery); const r = await appointmentService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await appointmentService.book(c.principal, await json(c.req)));
});
