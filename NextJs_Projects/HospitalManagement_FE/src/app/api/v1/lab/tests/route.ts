import { route, ok, created, json, query } from '@/server/http/api';
import { labService } from '@/server/services/laboratory.service';
import { z } from 'zod';

export const GET = route({}, async (c) => {
const q = query(c.req, z.object({ q: z.string().optional(), categoryId: z.coerce.number().optional() })); return ok(await labService.catalog(c.principal, q));
});
export const POST = route({}, async (c) => {
return created(await labService.createTest(c.principal, await json(c.req)));
});
