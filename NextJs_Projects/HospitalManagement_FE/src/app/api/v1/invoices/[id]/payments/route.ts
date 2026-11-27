import { route, created, json, idOf } from '@/server/http/api';
import { billingService } from '@/server/services/billing.service';

export const POST = route({}, async (c) => {
return created(await billingService.pay(c.principal, idOf(c.params.id), await json(c.req)));
});
