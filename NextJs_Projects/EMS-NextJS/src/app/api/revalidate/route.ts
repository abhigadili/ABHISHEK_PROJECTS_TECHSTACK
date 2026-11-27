import { revalidatePath, revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/server/env';

const TAGS = new Set(['departments', 'designations', 'leave-types', 'holidays', 'help', 'registration-options']);
const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * POST /api/revalidate  { "tag": "help" } | { "path": "/help/getting-started" }   — on-demand revalidation (ISR) for webhooks/CMS.
 * Protected by a shared secret header (constant-time compare). `revalidateTag(tag, 'max')` = stale-while-revalidate: the next request is
 * served the old page while the new one renders in the background.
 */
export async function POST(request: Request) {
  const secret = env.EMS_REVALIDATE_SECRET;
  const given = request.headers.get('x-revalidate-secret') ?? '';
  if (!secret || !eq(given, secret)) return Response.json({ error: { code: 'FORBIDDEN', message: 'Invalid secret' } }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { tag?: string; path?: string } | null;
  if (body?.tag) {
    if (!TAGS.has(body.tag)) return Response.json({ error: { code: 'BAD_REQUEST', message: 'Unknown tag' } }, { status: 400 });
    revalidateTag(body.tag, 'max');
    return Response.json({ revalidated: true, tag: body.tag });
  }
  if (body?.path?.startsWith('/')) { revalidatePath(body.path); return Response.json({ revalidated: true, path: body.path }); }
  return Response.json({ error: { code: 'BAD_REQUEST', message: 'Provide "tag" or "path"' } }, { status: 400 });
}
