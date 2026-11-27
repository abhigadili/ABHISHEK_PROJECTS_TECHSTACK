import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { appointmentService } from '@/server/services/appointment.service';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtTime } from '@/lib/utilities/format';
export default async function Today() {
  const p = await requireRole(['DOCTOR']); const d = await appointmentService.doctorDashboard(p);
  return <Card><CardHeader><CardTitle>Today&apos;s appointments</CardTitle><Link className="text-sm text-primary hover:underline" href="/doctor/appointments">All appointments</Link></CardHeader><CardBody>{d.today.length === 0 ? <EmptyState title="No appointments today" /> : <ul className="divide-y divide-line">{d.today.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-3"><div><Link className="font-medium hover:underline" href={`/doctor/appointments/${a.id}`}>{fmtTime(a.startsAt)} · {a.patient.user.firstName} {a.patient.user.lastName}</Link><p className="text-xs text-muted">{a.hospital.name} · {a.reason ?? 'No reason given'}</p></div><StatusBadge status={a.status} /></li>)}</ul>}</CardBody></Card>;
}
