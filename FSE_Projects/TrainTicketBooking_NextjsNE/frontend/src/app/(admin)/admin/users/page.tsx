import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { UsersGrid } from '@/features/admin/Grids';

export const metadata: Metadata = { title: 'Users & roles', robots: { index: false } };
/** Server shell: page-level role check (defence in depth) + metadata; the interactive grid is a lazy Client Component. */
export default async function Page() {
  await requireUser(['ADMIN']);
  return <div><PageHeader title="Users & roles" subtitle="Manage accounts, roles and access" /><UsersGrid /></div>;
}
