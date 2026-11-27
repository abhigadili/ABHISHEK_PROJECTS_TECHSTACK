import { route, paged, query } from '@/server/http/api';
import { patientService } from '@/server/services/patient.service';
import { patientQuery } from '@/lib/validations/patient';

export const GET = route({}, async (c) => {
const q = query(c.req, patientQuery); const r = await patientService.list(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
