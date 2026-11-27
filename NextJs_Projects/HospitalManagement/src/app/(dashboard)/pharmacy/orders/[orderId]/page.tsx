import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { pharmacyService } from '@/services/backend/pharmacy';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { OrderActions } from '@/features/pharmacy/OrderActions';
import { formatCurrency, formatDateTime } from '@/lib/utilities/format';

export const metadata = { title: 'Pharmacy order', robots: { index: false } };
export default async function OrderPage({ params }: PageProps<'/pharmacy/orders/[orderId]'>) {
  await requirePermission('pharmacy:manage');
  const o = await load(pharmacyService.order(parseId((await params).orderId)));
  return (
    <>
      <PageHeader title={`Order #${o.id}`} description={`For prescription #${o.prescriptionId} · ${o.patientName}`} actions={<OrderActions id={o.id} canAct={o.status === 'PENDING'} inStock={o.items.every((i) => i.inStock)} />} />
      <div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Items</CardTitle><StatusBadge status={o.status} /></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Medicine</TH><TH>Dosage</TH><TH>Qty</TH><TH>Unit price</TH><TH>Stock</TH></TR></THead><TBody>{o.items.map((i, n) => <TR key={n}><TD className="font-medium">{i.medicineName}</TD><TD>{i.dosage}</TD><TD className="num">{i.quantity}</TD><TD className="num">{i.unitPrice === null ? '—' : formatCurrency(i.unitPrice)}</TD><TD><Badge tone={i.inStock ? 'ok' : 'danger'}>{i.inStock ? 'In stock' : 'Unavailable'}</Badge></TD></TR>)}</TBody></Table></CardBody></Card>
        <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardBody className="space-y-2 text-sm"><p><b>Doctor:</b> {o.doctorName}</p><p><b>Total:</b> {formatCurrency(o.totalAmount)}</p><p><b>Created:</b> {formatDateTime(o.createdAt)}</p>{o.dispensedAt && <p><b>Dispensed:</b> {formatDateTime(o.dispensedAt)} by {o.dispensedBy}</p>}{o.rejectionReason && <p><b>Rejected:</b> {o.rejectionReason}</p>}<Link className="text-primary hover:underline" href={`/prescriptions/${o.prescriptionId}`}>View prescription →</Link></CardBody></Card></div>
    </>
  );
}
