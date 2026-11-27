import { NextResponse } from 'next/server';
import { db } from '@/server/db';
export const dynamic = 'force-dynamic';
export async function GET() { const up = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false); return NextResponse.json({ app: 'ok', database: up ? 'up' : 'down', time: new Date().toISOString() }, { status: up ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }); }
