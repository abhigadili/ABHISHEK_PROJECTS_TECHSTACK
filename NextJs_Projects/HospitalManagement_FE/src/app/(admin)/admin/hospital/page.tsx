import { requireRole } from '@/server/auth/guard';
import { hospitalService } from '@/server/services/hospital.service';
import { PageHeader } from '@/components/common/PageHeader';
import { HospitalForm } from '@/features/hospitals/HospitalForm';
import { Departments } from '@/features/hospitals/Departments';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
export const metadata = { title: 'Hospital management', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); if (!p.hospitalId) return <Alert tone="warn">Your account is not linked to a hospital.</Alert>;
  const h = await hospitalService.get(p, p.hospitalId); const canEdit = p.role === 'HOSPITAL_ADMIN';
  const facilities = ((h.facilities as string[] | null) ?? []).join(', '); const hours = (h.operatingHours as { text?: string } | null)?.text ?? '';
  return <><PageHeader title={h.name} description={`Code ${h.code} · ${h.branches.length} branch(es)`} />{canEdit ? <HospitalForm id={h.id} defaults={{ name: h.name, code: h.code, description: h.description ?? '', address: h.address ?? '', city: h.city ?? '', phone: h.phone ?? '', email: h.email ?? '', facilities, operatingHours: hours }} /> : <Alert>Only hospital administrators can edit the profile.</Alert>}
    <Card className="mt-6"><CardHeader><CardTitle>Departments</CardTitle></CardHeader><CardBody>{canEdit ? <Departments hospitalId={h.id} items={h.departments} /> : <ul className="grid gap-2 sm:grid-cols-2">{h.departments.map((d) => <li key={d.id} className="rounded-lg border border-line px-3 py-2 text-sm">{d.name}</li>)}</ul>}</CardBody></Card>
    <Card className="mt-6"><CardHeader><CardTitle>Doctor assignments</CardTitle></CardHeader><CardBody><ul className="grid gap-2 sm:grid-cols-2 text-sm">{h.assignments.map((a) => <li key={a.doctorId}>Dr. {a.doctor.user.firstName} {a.doctor.user.lastName} <span className="text-muted">· {a.doctor.specialization.name}{a.department ? ` · ${a.department.name}` : ''}</span></li>)}</ul></CardBody></Card></>;
}
