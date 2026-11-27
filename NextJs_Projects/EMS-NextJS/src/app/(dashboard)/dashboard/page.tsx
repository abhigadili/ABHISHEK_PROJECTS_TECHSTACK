import { Suspense } from 'react';
import type { Metadata } from 'next';
import { requireSession } from '@/lib/server/session';
import { PageHeader, Skeleton } from '@/components/common/ui';
import { can } from '@/constants/roles';
import { todayIso, formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };

async function Greeting() {
  const u = await requireSession(); // request-memoised: the layout already called it, the backend is hit once
  return <PageHeader title={`Welcome, ${u.name.split(' ')[0]}`} subtitle={`${can(u.role, 'dashboard:company') ? 'Company overview' : 'Your personal overview'} · ${formatDate(todayIso())}`} />;
}
/** `children` slot of the dashboard: just the heading. The three widgets below come from the parallel slots. */
export default function DashboardPage() {
  return <Suspense fallback={<div className="mb-6"><Skeleton className="h-8 w-64" /></div>}><Greeting /></Suspense>;
}
