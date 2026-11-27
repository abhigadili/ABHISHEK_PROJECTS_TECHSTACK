import { NextResponse } from 'next/server';
import { protectedHandler } from '@/lib/server/handler';
import { getBalances } from '@/lib/server/leaves';

export const GET = protectedHandler({}, async () => NextResponse.json(await getBalances(), { headers: { 'Cache-Control': 'private, no-store' } }));
