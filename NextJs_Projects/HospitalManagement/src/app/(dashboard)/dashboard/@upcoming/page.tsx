import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { getAppointmentStats, getMyPatientSnapshot } from '@/lib/dashboard/metrics';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatTime } from '@/lib/utilities/format';
import type { Appointment } from '@/types';

export default async function Upcoming() {
  const s = await requireSession();
  let rows: Appointment[] = [];
  if (s.role === 'PATIENT') rows = (await getMyPatientSnapshot(s.userId))?.upcoming.slice(0, 8) ?? [];
  else rows = (await getAppointmentStats(s.role))?.upcoming ?? [];
  return (
    <Card><CardHeader><CardTitle>Upcoming appointments</CardTitle><Link href="/appointments" className="text-sm text-primary hover:underline">View all</Link></CardHeader>
      <CardBody>{rows.length === 0 ? <EmptyState title="No upcoming appointments" description={s.role === 'LAB_STAFF' || s.role === 'PHARMACIST' || s.role === 'BILLING_STAFF' ? 'Your role does not have access to appointment data.' : undefined} /> : (
        <ul className="divide-y divide-line">{rows.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><Link href={`/appointments/${a.id}`} className="font-medium hover:underline">{s.role === 'PATIENT' ? a.doctorName : a.patientName}</Link><p className="text-xs text-muted">{s.role === 'PATIENT' ? '' : `with ${a.doctorName} · `}{formatDate(a.date)} {formatTime(a.startTime)}</p></div><StatusBadge status={a.status} /></li>)}</ul>
      )}</CardBody></Card>
  );
}
