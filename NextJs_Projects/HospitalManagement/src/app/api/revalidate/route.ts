import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { serverEnv } from '@/lib/config/env';
import { CACHE_TAGS } from '@/constants/cache';

/**
 * On-demand ISR webhook: POST /api/revalidate  { "tag": "doctors" } or { "path": "/public/doctors" }
 * Header `x-revalidate-secret` must equal REVALIDATE_SECRET (e.g. called by the Node.js backend after a doctor/hospital change).
 */
const KNOWN_TAGS = new Set<string>([CACHE_TAGS.hospitals, CACHE_TAGS.departments, CACHE_TAGS.doctors, CACHE_TAGS.pharmacy]);
export async function POST(req: NextRequest) {
  if (!serverEnv.revalidateSecret || req.headers.get('x-revalidate-secret') !== serverEnv.revalidateSecret) return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { tag?: string; path?: string };
  if (body.tag) { if (!KNOWN_TAGS.has(body.tag)) return NextResponse.json({ message: `Unknown tag ${body.tag}` }, { status: 400 }); revalidateTag(body.tag, 'max'); }
  if (body.path) { if (!body.path.startsWith('/public') && !body.path.startsWith('/')) return NextResponse.json({ message: 'Invalid path' }, { status: 400 }); revalidatePath(body.path); }
  if (!body.tag && !body.path) return NextResponse.json({ message: 'Provide tag or path' }, { status: 400 });
  return NextResponse.json({ revalidated: true, ...body, now: Date.now() });
}
