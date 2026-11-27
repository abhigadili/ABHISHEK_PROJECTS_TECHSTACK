import type { ReactNode } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
/** PARALLEL ROUTES: @stats and @today stream independently (each has its own loading.tsx) inside the /doctor overview. */
export default function Layout({ children, stats, today }: { children: ReactNode; stats: ReactNode; today: ReactNode }) {
  return <><PageHeader title="Doctor dashboard" description="Today at a glance." />{children}<section aria-label="Key figures" className="mb-6">{stats}</section><section aria-label="Today's appointments">{today}</section></>;
}
