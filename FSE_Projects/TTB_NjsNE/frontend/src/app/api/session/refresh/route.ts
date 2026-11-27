import { NextResponse, type NextRequest } from 'next/server';
import { RT_COOKIE } from '@/lib/constants';
import { refreshOnce } from '@/lib/server/refresh';
import { clearSession, writeSession } from '@/lib/server/session';

/** POST /api/session/refresh - rotates the session using the HttpOnly refresh cookie (called by the Axios interceptor). */
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const rt = req.cookies.get(RT_COOKIE)?.value;
  const result = rt ? await refreshOnce(rt) : null;
  if (!result) { const res = NextResponse.json({ ok: false, message: 'Session expired' }, { status: 401 }); clearSession(res.cookies); return res; }
  const res = NextResponse.json({ ok: true, user: result.user }, { headers: { 'cache-control': 'private, no-store' } });
  writeSession(res.cookies, result);
  return res;
}
