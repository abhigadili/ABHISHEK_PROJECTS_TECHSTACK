import { route, ok, query } from '@/server/http/api';
import { appointmentService } from '@/server/services/appointment.service';
import { slotsQuery } from '@/lib/validations/appointment';

export const GET = route({ permission: 'appointment:book' }, async (c) => {
const q = query(c.req, slotsQuery); return ok(await appointmentService.slots(q.doctorId, q.hospitalId, q.date));
});
