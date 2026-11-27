import { route, ok, idOf } from '@/server/http/api';
import { hospitalService } from '@/server/services/hospital.service';

export const GET = route({}, async (c) => {
return ok(await hospitalService.staff(c.principal, idOf(c.params.id)));
});
