import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/** Request cookies in, response cookies out: non-sensitive UI preferences (page size / density) kept in a cookie. */
const schema = z.object({ pageSize: z.coerce.number().int().refine((n) => [10, 20, 50].includes(n), 'pageSize must be 10, 20 or 50'), density: z.enum(['comfortable', 'compact']) });
const KEY = 'hms_pref';
const defaults = { pageSize: 20, density: 'comfortable' as const };
export async function GET(req: NextRequest) {
  try { return NextResponse.json({ ...defaults, ...JSON.parse(req.cookies.get(KEY)?.value ?? '{}') }); } catch { return NextResponse.json(defaults); }
}
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse({ ...defaults, ...(await req.json().catch(() => ({}))) });
  if (!parsed.success) return NextResponse.json({ status: 400, message: 'Validation failed', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
  const res = NextResponse.json(parsed.data, { status: 201 });
  res.cookies.set(KEY, JSON.stringify(parsed.data), { path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax' });
  return res;
}
export async function DELETE() { const res = new NextResponse(null, { status: 204 }); res.cookies.delete(KEY); return res; }
