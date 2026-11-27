import { route, created, json, idOf } from '@/server/http/api';
import { pharmacyService } from '@/server/services/pharmacy.service';

export const POST = route({}, async (c) => {
return created(await pharmacyService.dispense(c.principal, idOf(c.params.id), await json(c.req)));
});
