import { route, created, paged, json, query } from '@/server/http/api';
import { prescriptionService } from '@/server/services/prescription.service';
import { z } from 'zod';

export const GET = route({}, async (c) => {
const q = query(c.req, z.object({ patientId: z.coerce.number().optional(), status: z.string().optional(), page: z.coerce.number().default(0), size: z.coerce.number().default(15) })); const r = await prescriptionService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
export const POST = route({}, async (c) => {
return created(await prescriptionService.create(c.principal, await json(c.req)));
});
