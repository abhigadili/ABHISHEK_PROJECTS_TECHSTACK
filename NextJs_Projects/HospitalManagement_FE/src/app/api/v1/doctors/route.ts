import { route, created, paged, json, query } from '@/server/http/api';
import { doctorService } from '@/server/services/doctor.service';
import { doctorQuery } from '@/lib/validations/doctor';

export const GET = route({}, async (c) => {
const q = query(c.req, doctorQuery); const r = await doctorService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await doctorService.register(c.principal, await json(c.req)));
});
