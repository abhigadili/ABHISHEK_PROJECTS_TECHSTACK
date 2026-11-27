import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { StationsAdmin } from '@/features/admin/StationsAdmin';

export const metadata: Metadata = { title: 'Stations', robots: { index: false } };
/** Server shell: page-level role check (defence in depth) + metadata; the interactive grid is a lazy Client Component. */
export default async function Page() {
  await requireUser(['ADMIN']);
  return <div><PageHeader title="Stations" subtitle="Stops that trains can serve" /><StationsAdmin /></div>;
}
