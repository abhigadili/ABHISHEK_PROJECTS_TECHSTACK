import { route, created, json } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
import { registerPatientSchema } from '@/lib/validations/auth';
/** POST /api/v1/auth/register - patient self-registration (public). Sets the session cookies. */
export const POST = route({ public: true }, async (c) => created(await authService.registerPatient(registerPatientSchema.parse(await json(c.req)))));
