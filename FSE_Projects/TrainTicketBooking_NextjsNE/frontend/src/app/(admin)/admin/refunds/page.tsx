import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { RefundsGrid } from '@/features/admin/Grids';

export const metadata: Metadata = { title: 'Refunds', robots: { index: false } };
/** Server shell: page-level role check (defence in depth) + metadata; the interactive grid is a lazy Client Component. */
export default async function Page() {
  await requireUser(['ADMIN', 'BOOKING_STAFF']);
  return <div><PageHeader title="Refunds" subtitle="Refunds issued after cancellations" /><RefundsGrid /></div>;
}
