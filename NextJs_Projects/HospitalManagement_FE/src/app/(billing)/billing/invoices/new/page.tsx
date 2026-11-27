import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { env } from '@/lib/configuration/env';
import { PageHeader } from '@/components/common/PageHeader';
import { InvoiceForm } from '@/features/billing/InvoiceForm';
import { Alert } from '@/components/ui/empty-state';
export const metadata = { title: 'New invoice', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['BILLING_STAFF']); if (!p.hospitalId) return <Alert tone="warn">Your account is not linked to a hospital.</Alert>;
  const r = await patientService.list(p, { page: 0, size: 100, dir: 'asc' });
  return <><PageHeader title="New invoice" description="Tax is applied after the discount; the patient is notified." /><InvoiceForm hospitalId={p.hospitalId} taxRate={env.taxRate} patients={r.items.map((x) => ({ id: x.id, name: `${x.user.firstName} ${x.user.lastName}`, mrn: x.mrn }))} /></>;
}
