import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { appointmentService } from '@/server/services/appointment.service';
import { recordService } from '@/server/services/medical-record.service';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RecordForm } from '@/features/medical-records/RecordForm';
import { RecordList } from '@/features/medical-records/RecordList';
import { StatusButtons } from '@/features/appointments/StatusButtons';
import { fmtDateTime, age } from '@/lib/utilities/format';
export const metadata = { title: 'Consultation', robots: { index: false } };
/** Consultation management (Scenario 5 steps 1-3): appointment, patient history, new consultation record, links to prescription / lab request. */
export default async function Page({ params }: PageProps<'/doctor/appointments/[id]'>) {
  const p = await requireRole(['DOCTOR']); const a = await appointmentService.get(p, idOf((await params).id));
  const history = await recordService.list(p, a.patientId, { page: 0, size: 10 });
  const q = `patientId=${a.patientId}&appointmentId=${a.id}`;
  return <><PageHeader title={`${a.patient.user.firstName} ${a.patient.user.lastName}`} description={`${fmtDateTime(a.startsAt)} · ${a.hospital.name} · ${a.reason ?? 'No reason given'}`} actions={<><StatusBadge status={a.status} /><Button asChild variant="outline" size="sm"><Link href={`/doctor/prescriptions/new?${q}`}>Prescribe</Link></Button><Button asChild variant="outline" size="sm"><Link href={`/doctor/lab/new?${q}`}>Request lab test</Link></Button></>} />
    <div className="mb-4"><StatusButtons id={a.id} status={a.status} allow={['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']} /></div>
    <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-6"><Card><CardHeader><CardTitle>Record consultation</CardTitle></CardHeader><CardBody><RecordForm patientId={a.patientId} appointmentId={a.id} /></CardBody></Card></div><div><h2 className="mb-3 font-semibold">Patient medical history ({history.total})</h2><RecordList items={history.items} /><p className="mt-3 text-xs text-muted">Patient age {age(a.patient.dateOfBirth)} · MRN <span className="font-mono">{a.patient.mrn}</span></p></div></div></>;
}
