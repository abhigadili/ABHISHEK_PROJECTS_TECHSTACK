import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { TrainsAdmin } from '@/features/admin/TrainsAdmin';

export const metadata: Metadata = { title: 'Trains', robots: { index: false } };
/** Server shell: page-level role check (defence in depth) + metadata; the interactive grid is a lazy Client Component. */
export default async function Page() {
  await requireUser(['ADMIN', 'TRAIN_OPERATOR']);
  return <div><PageHeader title="Trains" subtitle="Fleet, routes, coaches and operating status" /><TrainsAdmin /></div>;
}
