import { route, paged, query, idOf } from '@/server/http/api';
import { recordService } from '@/server/services/medical-record.service';
import { recordQuery } from '@/lib/validations/clinical';

export const GET = route({}, async (c) => {
const q = query(c.req, recordQuery); const r = await recordService.list(c.principal, idOf(c.params.id), q); return paged(r.items, r.total, q.page, q.size);
});
