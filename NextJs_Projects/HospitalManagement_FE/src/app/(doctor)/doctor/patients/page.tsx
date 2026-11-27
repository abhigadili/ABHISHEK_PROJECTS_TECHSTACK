import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { patientQuery } from '@/lib/validations/patient';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { age } from '@/lib/utilities/format';
export const metadata = { title: 'Patients', robots: { index: false } };
/** Doctors only list patients under their care (appointment/record relationship checked in the service). */
export default async function Page({ searchParams }: PageProps<'/doctor/patients'>) {
  const p = await requireRole(['DOCTOR']); const q = patientQuery.parse(await searchParams); const r = await patientService.list(p, q);
  return <><PageHeader title="My patients" /><FilterBar placeholder="Search name, e-mail or MRN" />{r.items.length === 0 ? <EmptyState title="No patients yet" /> : <Table><THead><TR><TH>Patient</TH><TH>MRN</TH><TH>Age</TH><TH>Gender</TH><TH>Phone</TH></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD><Link className="font-medium text-primary hover:underline" href={`/doctor/patients/${x.id}`}>{x.user.firstName} {x.user.lastName}</Link></TD><TD className="font-mono text-xs">{x.mrn}</TD><TD className="num">{age(x.dateOfBirth)}</TD><TD>{x.gender.toLowerCase()}</TD><TD>{x.user.phone}</TD></TR>)}</TBody></Table>}<Pagination page={q.page} size={q.size} total={r.total} basePath="/doctor/patients" params={{ q: q.q }} /></>;
}
