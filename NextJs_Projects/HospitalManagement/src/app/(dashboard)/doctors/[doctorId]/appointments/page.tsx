import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { appointmentService } from '@/services/backend/appointments';
import { load, parseId } from '@/lib/api/guards';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatTime } from '@/lib/utilities/format';

export const metadata = { title: 'Doctor appointments', robots: { index: false } };
export default async function DoctorAppointments({ params }: PageProps<'/doctors/[doctorId]/appointments'>) {
  await requirePermission('appointments:doctor-view');
  const list = await load(appointmentService.byDoctor(parseId((await params).doctorId)));
  if (!list.length) return <EmptyState title="No appointments for this doctor" />;
  return <Table><THead><TR><TH>When</TH><TH>Patient</TH><TH>Reason</TH><TH>Status</TH></TR></THead><TBody>{[...list].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)).slice(0, 100).map((a) => <TR key={a.id}><TD><Link className="font-medium text-primary hover:underline" href={`/appointments/${a.id}`}>{formatDate(a.date)} {formatTime(a.startTime)}</Link></TD><TD>{a.patientName}</TD><TD className="max-w-60 truncate">{a.reason ?? '—'}</TD><TD><StatusBadge status={a.status} /></TD></TR>)}</TBody></Table>;
}
