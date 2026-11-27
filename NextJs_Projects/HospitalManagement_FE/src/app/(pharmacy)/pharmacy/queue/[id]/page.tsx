import { requireRole } from '@/server/auth/guard';
import { prescriptionService } from '@/server/services/prescription.service';
import { db } from '@/server/db';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { DispenseForm } from '@/features/pharmacy/PharmacyForms';
import { Alert } from '@/components/ui/empty-state';
import { fmtDate } from '@/lib/utilities/format';
export const metadata = { title: 'Dispense', robots: { index: false } };
/** Scenario 5 steps 10-12 (pharmacist): view the prescription, dispense (FEFO batches, transaction, invoice charges, notification). */
export default async function Page({ params }: PageProps<'/pharmacy/queue/[id]'>) {
  const p = await requireRole(['PHARMACIST']); const x = await prescriptionService.get(p, idOf((await params).id));
  const stock = await db.pharmacyInventory.groupBy({ by: ['medicineId'], where: { hospitalId: p.hospitalId ?? -1, quantity: { gt: 0 }, expiryDate: { gt: new Date() }, medicineId: { in: x.items.map((i) => i.medicineId) } }, _sum: { quantity: true } });
  const items = x.items.map((i) => ({ id: i.id, name: i.medicine.name, dosage: i.dosage, remaining: i.quantity - i.dispensedQty, stock: stock.find((s) => s.medicineId === i.medicineId)?._sum.quantity ?? 0 })).filter((i) => i.remaining > 0);
  return <><PageHeader title={`Prescription #${x.id}`} description={`${x.patient.user.firstName} ${x.patient.user.lastName} · Dr. ${x.doctor.user.lastName} · valid until ${fmtDate(x.validUntil)}`} actions={<StatusBadge status={x.status} />} /><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Prescribed</CardTitle></CardHeader><CardBody><ul className="space-y-2 text-sm">{x.items.map((i) => <li key={i.id}><b>{i.medicine.name}</b> {i.dosage}, {i.frequency} × {i.durationDays} d - qty {i.quantity} ({i.dispensedQty} dispensed){i.instructions && <span className="text-muted"> · {i.instructions}</span>}</li>)}</ul>{x.notes && <p className="mt-3 text-sm text-muted">{x.notes}</p>}</CardBody></Card><Card><CardHeader><CardTitle>Dispense</CardTitle></CardHeader><CardBody>{items.length === 0 || !['ACTIVE', 'PARTIALLY_DISPENSED'].includes(x.status) ? <Alert tone="info">Nothing left to dispense for this prescription.</Alert> : <DispenseForm prescriptionId={x.id} items={items} />}</CardBody></Card></div></>;
}
