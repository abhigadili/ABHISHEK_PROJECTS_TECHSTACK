import Link from 'next/link';
import { appointmentService } from '@/server/services/appointment.service';
import { appointmentQuery } from '@/lib/validations/appointment';
import { FilterBar } from '@/components/common/FilterBar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { StatusButtons } from './StatusButtons';
import { fmtDateTime } from '@/lib/utilities/format';
import type { Principal } from '@/server/authorization/principal';
/** Appointment search/filter/pagination for doctors and hospital staff (scope enforced inside the service). */
export async function StaffAppointmentTable({ p, searchParams, base, detailBase, allow }: { p: Principal; searchParams: Record<string, string | string[] | undefined>; base: string; detailBase?: string; allow: ('CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED')[] }) {
  const q = appointmentQuery.parse(searchParams); const r = await appointmentService.list(p, { ...q, dir: q.scope === 'past' ? 'desc' : 'asc' });
  return <><FilterBar placeholder="Search patient, doctor or code" selects={[{ name: 'scope', label: 'All time', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }] }, { name: 'status', label: 'Any status', options: ['CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => ({ value: s, label: s.replace('_', ' ').toLowerCase() })) }]} />
    {r.items.length === 0 ? <EmptyState title="No appointments" /> : <Table><THead><TR><TH>When</TH><TH>Patient</TH><TH>Doctor</TH><TH>Hospital</TH><TH>Status</TH><TH>Actions</TH></TR></THead><TBody>{r.items.map((a) => <TR key={a.id}><TD>{detailBase ? <Link className="font-medium text-primary hover:underline" href={`${detailBase}/${a.id}`}>{fmtDateTime(a.startsAt)}</Link> : fmtDateTime(a.startsAt)}</TD><TD>{a.patient.user.firstName} {a.patient.user.lastName}</TD><TD>Dr. {a.doctor.user.lastName}</TD><TD>{a.hospital.name}</TD><TD><StatusBadge status={a.status} /></TD><TD><StatusButtons id={a.id} status={a.status} allow={allow} /></TD></TR>)}</TBody></Table>}
    <Pagination page={q.page} size={q.size} total={r.total} basePath={base} params={{ q: q.q, scope: q.scope, status: q.status }} /></>;
}
