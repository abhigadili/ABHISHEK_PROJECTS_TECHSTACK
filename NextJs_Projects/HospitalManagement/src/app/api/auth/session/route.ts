import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { authService } from '@/services/backend/auth';

/** GET /api/auth/session -> the signed-in user (validated against the backend `/auth/me`) or 401. Never returns tokens. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ authenticated: false }, { status: 401 });
  try {
    const me = await authService.me();
    return NextResponse.json({ authenticated: true, user: me, expiresAt: s.expiresAt }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ authenticated: false }, { status: 401 }); }
}
