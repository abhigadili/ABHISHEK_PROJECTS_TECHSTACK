import { route, ok, idOf } from '@/server/http/api';
import { billingService } from '@/server/services/billing.service';

export const GET = route({}, async (c) => {
return ok(await billingService.get(c.principal, idOf(c.params.id)));
});
export const DELETE = route({}, async (c) => {
await billingService.cancel(c.principal, idOf(c.params.id)); return ok(null);
});
