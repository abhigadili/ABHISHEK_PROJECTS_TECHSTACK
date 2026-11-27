import type { ReactNode } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { getSession } from '@/lib/auth/session';
import { humanize } from '@/lib/utilities/format';

/**
 * Nested layout + PARALLEL ROUTES: `stats`, `upcoming` and `activity` are slots (@stats, @upcoming, @activity). Each slot has its own
 * loading.tsx, so the three sections stream in independently (Streaming + Suspense) - a slow billing call never blocks the cards.
 */
export const metadata = { title: 'Dashboard' };
export default async function DashboardSectionLayout({ children, stats, upcoming, activity }: { children: ReactNode; stats: ReactNode; upcoming: ReactNode; activity: ReactNode }) {
  const s = await getSession();
  return (
    <>
      <PageHeader title={`Welcome, ${s?.username ?? ''}`} description={`Signed in as ${s ? humanize(s.role) : ''}. Figures are read live from the hospital services.`} />
      {children}
      <section aria-label="Key figures" className="mb-6">{stats}</section>
      <div className="grid gap-6 xl:grid-cols-2"><section aria-label="Upcoming appointments">{upcoming}</section><section aria-label="Recent activity">{activity}</section></div>
    </>
  );
}
