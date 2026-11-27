import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prescriptionService } from '@/services/backend/prescriptions';
import { pharmacyService } from '@/services/backend/pharmacy';
import { load, loadOptional, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { PrescriptionActions } from '@/features/prescriptions/PrescriptionActions';
import { can } from '@/constants/permissions';
import { formatDate } from '@/lib/utilities/format';

export const metadata: Metadata = { title: 'Prescription', robots: { index: false } };
export default async function PrescriptionPage({ params }: PageProps<'/prescriptions/[prescriptionId]'>) {
  const s = await requirePermission('prescriptions:read');
  const rx = await load(prescriptionService.get(parseId((await params).prescriptionId)));
  const order = can(s.role, 'pharmacy:access') ? await loadOptional(pharmacyService.orderByPrescription(rx.id)) : null;
  return (
    <>
      <PageHeader title={`Prescription #${rx.id}`} description={`Issued ${formatDate(rx.issuedAt)} · valid until ${formatDate(rx.validUntil)}`} actions={<PrescriptionActions id={rx.id} status={rx.status} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Medicines</CardTitle></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Medicine</TH><TH>Dosage</TH><TH>Frequency</TH><TH>Days</TH><TH>Qty</TH><TH>Instructions</TH></TR></THead><TBody>{rx.items.map((i) => <TR key={i.id}><TD className="font-medium">{i.medicineName}</TD><TD>{i.dosage}</TD><TD>{i.frequency}</TD><TD className="num">{i.durationDays}</TD><TD className="num">{i.quantity}</TD><TD>{i.instructions ?? '—'}</TD></TR>)}</TBody></Table></CardBody></Card>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardBody className="space-y-2 text-sm"><p><b>Patient:</b> {can(s.role, 'patients:read') ? <Link className="text-primary hover:underline" href={`/patients/${rx.patientId}`}>{rx.patientName}</Link> : rx.patientName}</p><p><b>Doctor:</b> {rx.doctorName}</p><p><b>Diagnosis:</b> {rx.diagnosis ?? '—'}</p>{rx.notes && <p><b>Notes:</b> {rx.notes}</p>}</CardBody></Card>
          {order && <Card><CardHeader><CardTitle>Pharmacy order</CardTitle><StatusBadge status={order.status} /></CardHeader><CardBody className="text-sm"><Link className="text-primary hover:underline" href={`/pharmacy/orders/${order.id}`}>Order #{order.id}</Link> · {order.items.filter((i) => i.inStock).length}/{order.items.length} in stock</CardBody></Card>}
        </div>
      </div>
    </>
  );
}
