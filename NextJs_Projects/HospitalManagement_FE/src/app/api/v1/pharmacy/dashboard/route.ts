import { route, ok } from '@/server/http/api';
import { pharmacyService } from '@/server/services/pharmacy.service';

export const GET = route({}, async (c) => {
return ok(await pharmacyService.dashboard(c.principal));
});
