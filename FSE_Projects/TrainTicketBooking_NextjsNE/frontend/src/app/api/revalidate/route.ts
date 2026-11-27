import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * On-demand revalidation webhook. POST { tag?: string, path?: string } with header `x-revalidate-secret`.
 * Lets an operator (or a script on the Express side) purge cached public pages without a redeploy.
 */
const body = z.object({ tag: z.string().min(1).optional(), path: z.string().startsWith('/').optional() }).refine((v) => v.tag || v.path, 'Provide tag or path');
export async function POST(req: NextRequest) {
  if (!process.env.REVALIDATE_SECRET || req.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0].message }, { status: 400 });
  if (parsed.data.tag) revalidateTag(parsed.data.tag, 'max'); // stale-while-revalidate semantics
  if (parsed.data.path) revalidatePath(parsed.data.path);
  return NextResponse.json({ ok: true, revalidated: parsed.data, at: new Date().toISOString() });
}
