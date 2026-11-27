import { route, ok, json, idOf } from '@/server/http/api';
import { pharmacyService } from '@/server/services/pharmacy.service';

export const POST = route({}, async (c) => {
await pharmacyService.adjustStock(c.principal, idOf(c.params.id), await json(c.req)); return ok(null);
});
