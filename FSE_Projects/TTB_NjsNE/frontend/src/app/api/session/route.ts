import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';

/** GET /api/session -> the signed-in user (or null). Private: never cached. */
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user }, { headers: { 'cache-control': 'private, no-store' } });
}
