import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { appointmentService } from '@/server/services/appointment.service';
import { appointmentQuery } from '@/lib/validations/appointment';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'My appointments', robots: { index: false } };
export default async function Appointments({ searchParams }: PageProps<'/patient/appointments'>) {
  const p = await requireRole(['PATIENT']); const q = appointmentQuery.parse(await searchParams); const r = await appointmentService.list(p, { ...q, dir: q.scope === 'past' ? 'desc' : 'asc' });
  return <><PageHeader title="My appointments" description="Click a row to open it as a modal (intercepting route)." actions={<Button asChild><Link href="/patient/book">Book appointment</Link></Button>} />
    <FilterBar placeholder="Search doctor or code" selects={[{ name: 'scope', label: 'All time', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }] }, { name: 'status', label: 'Any status', options: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => ({ value: s, label: s.replace('_', ' ').toLowerCase() })) }]} />
    {r.items.length === 0 ? <EmptyState title="No appointments" /> : <Table><THead><TR><TH>When</TH><TH>Doctor</TH><TH>Hospital</TH><TH>Code</TH><TH>Status</TH></TR></THead><TBody>{r.items.map((a) => <TR key={a.id}><TD><Link className="font-medium text-primary hover:underline" href={`/patient/appointments/${a.id}`}>{fmtDateTime(a.startsAt)}</Link></TD><TD>Dr. {a.doctor.user.lastName} <span className="text-xs text-muted">{a.doctor.specialization.name}</span></TD><TD>{a.hospital.name}</TD><TD className="font-mono text-xs">{a.confirmationCode}</TD><TD><StatusBadge status={a.status} /></TD></TR>)}</TBody></Table>}
    <Pagination page={q.page} size={q.size} total={r.total} basePath="/patient/appointments" params={{ q: q.q, scope: q.scope, status: q.status }} /></>;
}
