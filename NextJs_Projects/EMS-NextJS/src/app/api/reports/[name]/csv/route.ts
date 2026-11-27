import { NextResponse } from 'next/server';
import { protectedHandler } from '@/lib/server/handler';
import { CSV_REPORTS, fetchCsv, type CsvReport } from '@/lib/server/reports';
import { ApiError } from '@/lib/server/api-client';

const isReport = (n: string): n is CsvReport => Object.hasOwn(CSV_REPORTS, n);

/**
 * GET /api/reports/:name/csv?year=&month=&from=&to= — FILE DOWNLOAD (attachment). `:name` must be in a fixed allow-list, so this endpoint
 * can never be used to proxy arbitrary backend URLs. Role rules are enforced by the backend (403 → forwarded).
 */
export const GET = protectedHandler<{ name: string }>({ permission: 'reports:view' }, async (req, _u, p) => {
  if (!isReport(p.name)) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown report' } }, { status: 404 });
  const q: Record<string, string | undefined> = {};
  for (const k of ['year', 'month', 'from', 'to', 'departmentId']) { const v = req.nextUrl.searchParams.get(k); if (v && /^[\w-]{1,10}$/.test(v)) q[k] = v; }
  const up = await fetchCsv(p.name, q).catch((e) => { throw e instanceof ApiError ? e : new ApiError(502, 'UPSTREAM', 'Report unavailable'); });
  return new Response(up.body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${p.name}.csv"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
});
