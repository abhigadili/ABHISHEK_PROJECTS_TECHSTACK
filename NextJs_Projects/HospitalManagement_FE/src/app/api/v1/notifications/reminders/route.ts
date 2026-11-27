import { route, ok } from '@/server/http/api';
import { appointmentService } from '@/server/services/appointment.service';

export const POST = route({}, async (c) => {
return ok({ reminded: await appointmentService.sendDueReminders(c.principal) });
});
