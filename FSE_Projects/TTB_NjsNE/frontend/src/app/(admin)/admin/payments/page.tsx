import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { PaymentsGrid } from '@/features/admin/Grids';

export const metadata: Metadata = { title: 'Payments', robots: { index: false } };
/** Server shell: page-level role check (defence in depth) + metadata; the interactive grid is a lazy Client Component. */
export default async function Page() {
  await requireUser(['ADMIN', 'BOOKING_STAFF']);
  return <div><PageHeader title="Payments" subtitle="All payment attempts" /><PaymentsGrid /></div>;
}
