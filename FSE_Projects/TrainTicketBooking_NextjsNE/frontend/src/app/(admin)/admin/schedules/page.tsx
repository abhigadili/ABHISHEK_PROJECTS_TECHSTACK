import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { SchedulesAdmin } from '@/features/admin/SchedulesAdmin';

export const metadata: Metadata = { title: 'Schedules', robots: { index: false } };
/** Server shell: page-level role check (defence in depth) + metadata; the interactive grid is a lazy Client Component. */
export default async function Page() {
  await requireUser(['ADMIN', 'TRAIN_OPERATOR']);
  return <div><PageHeader title="Schedules" subtitle="Which days each train runs" /><SchedulesAdmin /></div>;
}
