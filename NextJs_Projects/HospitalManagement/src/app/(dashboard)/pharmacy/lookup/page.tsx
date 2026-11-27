import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { pharmacyService } from '@/services/backend/pharmacy';
import { prescriptionService } from '@/services/backend/prescriptions';
import { loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utilities/format';

export const metadata = { title: 'Prescription lookup', robots: { index: false } };
/** Prescription-based medicine lookup: GET form -> searchParams -> two backend calls in parallel (prescription + its pharmacy order). */
export default async function Lookup({ searchParams }: PageProps<'/pharmacy/lookup'>) {
  const s = await requirePermission('pharmacy:access');
  const id = Number((await searchParams).prescriptionId) || 0;
  const [rx, order] = id ? await Promise.all([loadOptional(prescriptionService.get(id)), loadOptional(pharmacyService.orderByPrescription(id))]) : [null, null];
  return (
    <>
      <PageHeader title="Prescription lookup" description="Enter a prescription number to see its medicines and order." />
      <form className="mb-4 flex max-w-sm gap-2"><Input name="prescriptionId" type="number" min="1" placeholder="Prescription #" defaultValue={id || ''} aria-label="Prescription number" /><Button type="submit">Look up</Button></form>
      {id !== 0 && !rx && !order && <Alert tone="warn">No prescription #{id} was found, or your role cannot read it.</Alert>}
      {(rx || order) && <Card className="max-w-2xl"><CardBody className="space-y-3 text-sm">{rx && <><p className="font-medium">Prescription #{rx.id} for {rx.patientName} <StatusBadge status={rx.status} /></p><ul className="list-disc pl-5">{rx.items.map((i) => <li key={i.id}>{i.medicineName} {i.dosage}, {i.frequency} × {i.durationDays} d (qty {i.quantity})</li>)}</ul></>}{order && <p>Pharmacy order <Link className="text-primary hover:underline" href={s.role === 'DOCTOR' ? '#' : `/pharmacy/orders/${order.id}`}>#{order.id}</Link> <StatusBadge status={order.status} /> · {formatCurrency(order.totalAmount)}</p>}</CardBody></Card>}
    </>
  );
}
