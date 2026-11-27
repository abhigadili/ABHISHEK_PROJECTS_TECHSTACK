import { route, created, paged, json, query } from '@/server/http/api';
import { billingService } from '@/server/services/billing.service';
import { invoiceQuery } from '@/lib/validations/billing';

export const GET = route({}, async (c) => {
const q = query(c.req, invoiceQuery); const r = await billingService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await billingService.create(c.principal, await json(c.req)));
});
