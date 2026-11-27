import { requireRole } from '@/server/auth/guard';
import { prescriptionService } from '@/server/services/prescription.service';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { PrintButton } from '@/features/prescriptions/PrintButton';
import { fmtDate } from '@/lib/utilities/format';
export const metadata = { title: 'Prescription', robots: { index: false } };
export default async function Page({ params }: PageProps<'/patient/prescriptions/[id]'>) {
  const p = await requireRole(['PATIENT']); const x = await prescriptionService.get(p, idOf((await params).id));
  return <><PageHeader title={`Prescription #${x.id}`} description={`Issued ${fmtDate(x.createdAt)} · valid until ${fmtDate(x.validUntil)}`} actions={<><StatusBadge status={x.status} /><PrintButton /></>} />
    <div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Medicines</CardTitle></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Medicine</TH><TH>Dosage</TH><TH>Frequency</TH><TH>Days</TH><TH>Qty</TH><TH>Dispensed</TH></TR></THead><TBody>{x.items.map((i) => <TR key={i.id}><TD className="font-medium">{i.medicine.name}{i.instructions && <div className="text-xs font-normal text-muted">{i.instructions}</div>}</TD><TD>{i.dosage}</TD><TD>{i.frequency}</TD><TD className="num">{i.durationDays}</TD><TD className="num">{i.quantity}</TD><TD className="num">{i.dispensedQty}</TD></TR>)}</TBody></Table></CardBody></Card>
      <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardBody className="space-y-2 text-sm"><p><b>Doctor:</b> Dr. {x.doctor.user.firstName} {x.doctor.user.lastName}</p><p><b>Diagnosis:</b> {x.diagnosis}</p>{x.notes && <p><b>Notes:</b> {x.notes}</p>}</CardBody></Card></div></>;
}
