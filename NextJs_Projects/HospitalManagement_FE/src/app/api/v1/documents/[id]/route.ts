import { route, idOf } from '@/server/http/api';
import { recordService } from '@/server/services/medical-record.service';
/** GET /api/v1/documents/:id - authorised file download (never served from /public). */
export const GET = route({}, async (c) => {
  const { doc, data } = await recordService.download(c.principal, idOf(c.params.id));
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': doc.mimeType, 'Content-Disposition': `attachment; filename="${doc.fileName}"`, 'Cache-Control': 'private, no-store' } });
});
