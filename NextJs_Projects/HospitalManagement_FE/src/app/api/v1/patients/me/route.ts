import { route, ok } from '@/server/http/api';
import { patientService } from '@/server/services/patient.service';

export const GET = route({}, async (c) => {
return ok(await patientService.me(c.principal));
});
