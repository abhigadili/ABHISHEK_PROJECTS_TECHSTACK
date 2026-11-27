import { NextResponse } from 'next/server';
import { errorResponse, guard } from '@/lib/api/route-helpers';
import { getAppointmentStats, getBillingStats, getLabStats, getPeopleCounts } from '@/lib/dashboard/metrics';

/** GET /api/dashboard/summary - role-aware aggregation over several backend services (Promise.all). The one place a BFF endpoint adds value. */
export async function GET() {
  const g = await guard(); if ('response' in g) return g.response;
  try {
    const role = g.session.role;
    const [people, appts, lab, billing] = await Promise.all([getPeopleCounts(role), getAppointmentStats(role), getLabStats(role), getBillingStats(role)]);
    return NextResponse.json({ people, appointments: appts && { total: appts.total, today: appts.today, pending: appts.pending, completed: appts.completed }, lab, billing }, { headers: { 'Cache-Control': 'private, max-age=15' } });
  } catch (e) { return errorResponse(e); }
}
