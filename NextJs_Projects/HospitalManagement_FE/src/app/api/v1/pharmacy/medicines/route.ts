import { route, created, paged, json, query } from '@/server/http/api';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { z } from 'zod';

export const GET = route({}, async (c) => {
const q = query(c.req, z.object({ q: z.string().optional(), categoryId: z.coerce.number().optional(), page: z.coerce.number().default(0), size: z.coerce.number().default(20) })); const r = await pharmacyService.medicines(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await pharmacyService.createMedicine(c.principal, await json(c.req)));
});
