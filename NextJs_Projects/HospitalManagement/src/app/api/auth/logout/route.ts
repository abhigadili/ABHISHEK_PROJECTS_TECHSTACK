import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/backend/auth';
import { AT_COOKIE, ROLE_COOKIE, RT_COOKIE } from '@/lib/auth/constants';

/** POST /api/auth/logout - used by the idle-timeout logout (fetch/sendBeacon): revokes the refresh token and clears cookies (Response Cookies). */
export async function POST(req: NextRequest) {
  const rt = req.cookies.get(RT_COOKIE)?.value;
  if (rt) await authService.logout(rt).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  for (const n of [AT_COOKIE, RT_COOKIE, ROLE_COOKIE]) res.cookies.delete(n);
  return res;
}
