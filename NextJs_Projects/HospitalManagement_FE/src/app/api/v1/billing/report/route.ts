import { route, ok } from '@/server/http/api';
import { billingService } from '@/server/services/billing.service';

export const GET = route({}, async (c) => {
return ok(await billingService.report(c.principal));
});
