import { requireRole } from '@/server/auth/guard';
import { hospitalService } from '@/server/services/hospital.service';
import { PageHeader } from '@/components/common/PageHeader';
import { HospitalForm } from '@/features/hospitals/HospitalForm';
import { DeleteHospitalButton } from '@/features/admin/HospitalAdmin';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
export const metadata = { title: 'Hospital management', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['SUPER_ADMIN']); const r = await hospitalService.list(p, { page: 0, size: 50, dir: 'asc' });
  return <><PageHeader title="Hospitals & branches" description="Register hospitals; removing is a soft delete." /><Table><THead><TR><TH>Name</TH><TH>Code</TH><TH>City</TH><TH>Departments</TH><TH>Doctors</TH><TH>Status</TH><TH /></TR></THead><TBody>{r.items.map((h) => <TR key={h.id}><TD className="font-medium">{h.name}{h.parentId && <span className="ml-2 text-xs text-muted">branch</span>}</TD><TD className="font-mono text-xs">{h.code}</TD><TD>{h.city}</TD><TD className="num">{h._count.departments}</TD><TD className="num">{h._count.assignments}</TD><TD><StatusBadge status={h.active ? 'ACTIVE' : 'SUSPENDED'} /></TD><TD><DeleteHospitalButton id={h.id} name={h.name} /></TD></TR>)}</TBody></Table><Card className="mt-6"><CardHeader><CardTitle>Register a hospital</CardTitle></CardHeader><CardBody><HospitalForm id={null} defaults={{ name: '', code: '', description: '', address: '', city: '', phone: '', email: '', facilities: '', operatingHours: '' }} /></CardBody></Card></>;
}
