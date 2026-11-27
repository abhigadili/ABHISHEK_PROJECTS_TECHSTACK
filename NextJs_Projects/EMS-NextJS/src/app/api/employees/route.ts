import { NextResponse } from 'next/server';
import { protectedHandler } from '@/lib/server/handler';
import { listEmployees } from '@/lib/server/employees';
import { int, one } from '@/lib/utils/search-params';

/** GET /api/employees?search=&limit=&page=&department= — JSON for client-side typeahead. Same data layer as the Server Components. */
export const GET = protectedHandler({}, async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const { items, meta } = await listEmployees({ page: int(sp.page, 1), limit: int(sp.limit, 10, 1, 50), search: one(sp.search), department: one(sp.department), status: one(sp.status), sort: one(sp.sort) });
  // slim projection: only what the UI needs, no salary/personal data leaves the server through this endpoint
  return NextResponse.json({ items: items.map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, jobTitle: e.jobTitle, department: e.department, status: e.status })), meta }, { headers: { 'Cache-Control': 'private, no-store' } });
});
