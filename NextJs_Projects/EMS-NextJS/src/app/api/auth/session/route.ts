import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';

/** GET /api/auth/session → the current user's NON-sensitive profile, or 401. Never returns tokens (they are HttpOnly cookies). */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'You are not signed in' } }, { status: 401 });
  return NextResponse.json({ user: { id: s.id, name: s.name, role: s.role, employeeId: s.employeeId } }, { headers: { 'Cache-Control': 'private, no-store' } });
}
