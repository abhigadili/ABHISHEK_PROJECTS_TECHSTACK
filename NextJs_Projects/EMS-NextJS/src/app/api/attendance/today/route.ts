import { NextResponse } from 'next/server';
import { protectedHandler } from '@/lib/server/handler';
import { listAttendance } from '@/lib/server/attendance';
import { todayIso } from '@/lib/utils/format';

export const GET = protectedHandler({}, async () => {
  const d = todayIso();
  const { items } = await listAttendance('me', { from: d, to: d, limit: 1 });
  return NextResponse.json({ record: items[0] ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
});
