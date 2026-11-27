import { route, ok } from '@/server/http/api';
import { doctorService } from '@/server/services/doctor.service';

export const GET = route({ permission: 'doctor:read' }, async () => {
return ok(await doctorService.specializations());
});
