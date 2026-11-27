import { NextRequest, NextResponse } from 'next/server';
import { patientService } from '@/services/backend/patients';
import { guard } from '@/lib/api/route-helpers';

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Streaming CSV download: pages are pulled from the backend one by one and flushed as they arrive (ReadableStream response). */
export async function GET(req: NextRequest) {
  const g = await guard('patients:read'); if ('response' in g) return g.response;
  const q = req.nextUrl.searchParams.get('q') ?? undefined;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(enc.encode('id,firstName,lastName,gender,dateOfBirth,email,phone,status\n'));
        for (let page = 0; page < 50; page++) {
          const p = await patientService.list({ q, page, size: 100 });
          for (const r of p.content) controller.enqueue(enc.encode([r.id, r.firstName, r.lastName, r.gender, r.dateOfBirth, r.email, r.phone, r.status].map(cell).join(',') + '\n'));
          if (page + 1 >= p.totalPages) break;
        }
        controller.close();
      } catch (e) { controller.error(e); }
    },
  });
  return new NextResponse(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="patients.csv"', 'Cache-Control': 'private, no-store' } });
}
export const runtime = 'nodejs';
