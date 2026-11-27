import { NextRequest, NextResponse } from 'next/server';
import { usernameAvailable } from '@/lib/server/auth';
import { USERNAME_RE } from '@/schemas/forms';
import { errorResponse } from '@/lib/server/handler';

/** PUBLIC GET /api/auth/username-available?username= — backs the registration form's live check (debounced + cancellable in the browser). */
export async function GET(req: NextRequest) {
  const username = (req.nextUrl.searchParams.get('username') ?? '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid username' } }, { status: 400 });
  try { return NextResponse.json({ available: await usernameAvailable(username) }, { headers: { 'Cache-Control': 'no-store' } }); } catch (e) { return errorResponse(e); }
}
