import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { PageHeader } from '@/components/common/PageHeader';
import { MedicineBrowser } from '@/features/pharmacy/MedicineBrowser';
import { Button } from '@/components/ui/button';
import { can } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Pharmacy', robots: { index: false } };
export default async function PharmacyPage() {
  const s = await requirePermission('pharmacy:access');
  return <><PageHeader title="Pharmacy" description="Medicine catalogue, availability and stock." actions={<>{can(s.role, 'pharmacy:manage') && <Button asChild variant="outline"><Link href="/pharmacy/orders">Orders</Link></Button>}<Button asChild variant="outline"><Link href="/pharmacy/lookup">Prescription lookup</Link></Button></>} /><MedicineBrowser /></>;
}
