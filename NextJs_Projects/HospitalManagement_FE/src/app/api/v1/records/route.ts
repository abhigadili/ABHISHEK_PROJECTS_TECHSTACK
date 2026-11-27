import { route, created, json } from '@/server/http/api';
import { recordService } from '@/server/services/medical-record.service';

export const POST = route({}, async (c) => {
return created(await recordService.create(c.principal, await json(c.req)));
});
