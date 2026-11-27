import { route, created, paged, json, query } from '@/server/http/api';
import { hospitalService } from '@/server/services/hospital.service';
import { hospitalQuery } from '@/lib/validations/hospital';

export const GET = route({}, async (c) => {
const q = query(c.req, hospitalQuery); const r = await hospitalService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await hospitalService.create(c.principal, await json(c.req)));
});
