import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { recordService } from '@/server/services/medical-record.service';
import { prescriptionService } from '@/server/services/prescription.service';
import { labService } from '@/server/services/laboratory.service';
import { assertClinicalAccess } from '@/server/authorization/access';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { PatientTabs } from '@/features/doctors/PatientTabs';
import { RecordForm } from '@/features/medical-records/RecordForm';
import { RecordList } from '@/features/medical-records/RecordList';
import { age, fmtDate, fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Patient', robots: { index: false } };
async function Records({ pid }: { pid: number }) { const p = await requireRole(['DOCTOR']); return <RecordList items={(await recordService.list(p, pid, { page: 0, size: 50 })).items} />; }
async function Prescriptions({ pid }: { pid: number }) { const p = await requireRole(['DOCTOR']); const r = await prescriptionService.list(p, { patientId: pid, page: 0, size: 20 }); return r.items.length === 0 ? <EmptyState title="No prescriptions by you" /> : <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{r.items.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 p-3 text-sm"><span>#{x.id} · {fmtDate(x.createdAt)} · {x.diagnosis} · {x.items.length} medicine(s)</span><StatusBadge status={x.status} /></li>)}</ul>; }
async function Labs({ pid }: { pid: number }) { const p = await requireRole(['DOCTOR']); const r = await labService.list(p, { patientId: pid, page: 0, size: 20 }); return r.items.length === 0 ? <EmptyState title="No lab requests" /> : <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{r.items.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 p-3 text-sm"><span><Link className="text-primary hover:underline" href={`/doctor/lab/${x.id}`}>{x.test.name}</Link> · {fmtDateTime(x.requestedAt)}</span><span className="flex gap-2">{x.report?.published && x.report.abnormal && <Badge tone="danger">Abnormal</Badge>}<StatusBadge status={x.status} /></span></li>)}</ul>; }
export default async function Page({ params }: PageProps<'/doctor/patients/[id]'>) {
  const p = await requireRole(['DOCTOR']); const id = idOf((await params).id); const x = await patientService.get(p, id); await assertClinicalAccess(p, id);
  return <><PageHeader title={`${x.user.firstName} ${x.user.lastName}`} description={`MRN ${x.mrn} · ${age(x.dateOfBirth)} yrs · ${x.gender.toLowerCase()}${x.bloodGroup ? ` · ${x.bloodGroup}` : ''}`} actions={<><Button asChild size="sm" variant="outline"><Link href={`/doctor/prescriptions/new?patientId=${id}`}>Prescribe</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/doctor/lab/new?patientId=${id}`}>Request lab test</Link></Button></>} />
    <Card className="mb-6"><CardBody className="grid gap-3 text-sm sm:grid-cols-3"><p><b>Phone:</b> {x.user.phone}</p><p><b>Emergency contact:</b> {x.emergencyContactName ? `${x.emergencyContactName} (${x.emergencyContactPhone})` : '—'}</p><p><b>Self-reported history:</b> {x.medicalHistory ?? '—'}</p></CardBody></Card>
    <PatientTabs records={<Suspense fallback={<TableSkeleton rows={3} />}><Records pid={id} /></Suspense>} prescriptions={<Suspense fallback={<TableSkeleton rows={3} />}><Prescriptions pid={id} /></Suspense>} labs={<Suspense fallback={<TableSkeleton rows={3} />}><Labs pid={id} /></Suspense>} add={<Card><CardBody><RecordForm patientId={id} /></CardBody></Card>} /></>;
}
