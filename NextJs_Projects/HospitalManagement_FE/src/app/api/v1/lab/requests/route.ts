import { route, created, paged, json, query } from '@/server/http/api';
import { labService } from '@/server/services/laboratory.service';
import { z } from 'zod';

export const GET = route({}, async (c) => {
const q = query(c.req, z.object({ status: z.string().optional(), patientId: z.coerce.number().optional(), page: z.coerce.number().default(0), size: z.coerce.number().default(15) })); const r = await labService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await labService.request(c.principal, await json(c.req)));
});
