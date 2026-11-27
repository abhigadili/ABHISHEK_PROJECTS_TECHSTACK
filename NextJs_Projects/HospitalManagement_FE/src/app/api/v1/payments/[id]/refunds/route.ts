import { route, created, json, idOf } from '@/server/http/api';
import { billingService } from '@/server/services/billing.service';

export const POST = route({}, async (c) => {
await billingService.refund(c.principal, idOf(c.params.id), await json(c.req)); return created(null);
});
