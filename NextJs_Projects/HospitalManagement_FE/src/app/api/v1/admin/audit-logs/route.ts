import { route, paged, query } from '@/server/http/api';
import { adminService } from '@/server/services/admin.service';
import { pageQuery } from '@/lib/validations/common';

export const GET = route({}, async (c) => {
const q = query(c.req, pageQuery); const r = await adminService.auditLogs(c.principal, q); return paged(r.items, r.total, q.page, q.size);
});
