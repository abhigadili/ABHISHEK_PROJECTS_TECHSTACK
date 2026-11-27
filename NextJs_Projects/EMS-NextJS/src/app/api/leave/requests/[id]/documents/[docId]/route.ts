import { protectedHandler } from '@/lib/server/handler';
import { downloadLeaveDocument } from '@/lib/server/leaves';
import { ApiError } from '@/lib/server/api-client';

/** GET — streams a leave attachment as a DOWNLOAD (`attachment`, nosniff): user-uploaded files are never rendered inline from our origin. Authorization is the backend's. */
export const GET = protectedHandler<{ id: string; docId: string }>({}, async (_req, _u, p) => {
  const id = Number(p.id), docId = Number(p.docId);
  if (![id, docId].every((n) => Number.isInteger(n) && n > 0)) throw new ApiError(400, 'BAD_REQUEST', 'Invalid id');
  const up = await downloadLeaveDocument(id, docId);
  const type = up.headers.get('content-type') ?? 'application/octet-stream';
  return new Response(up.body, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="leave-${id}-document-${docId}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
});
