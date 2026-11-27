import Link from 'next/link';
import { appointmentService } from '@/services/backend/appointments';
import { load, parseId } from '@/lib/api/guards';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDate, formatTime } from '@/lib/utilities/format';

export const metadata = { title: 'Patient appointments', robots: { index: false } };
export default async function PatientAppointments({ params }: PageProps<'/patients/[patientId]/appointments'>) {
  const list = await load(appointmentService.byPatient(parseId((await params).patientId)));
  if (!list.length) return <EmptyState title="No appointments yet" description="Booked appointments appear here (appointment history)." />;
  return <Table><THead><TR><TH>Date</TH><TH>Doctor</TH><TH>Reason</TH><TH>Fee</TH><TH>Payment</TH><TH>Status</TH></TR></THead><TBody>{[...list].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)).map((a) => <TR key={a.id}><TD><Link className="font-medium text-primary hover:underline" href={`/appointments/${a.id}`}>{formatDate(a.date)} {formatTime(a.startTime)}</Link></TD><TD>{a.doctorName}</TD><TD className="max-w-60 truncate">{a.reason ?? '—'}</TD><TD className="num">{formatCurrency(a.fee)}</TD><TD><StatusBadge status={a.paymentStatus} /></TD><TD><StatusBadge status={a.status} /></TD></TR>)}</TBody></Table>;
}
