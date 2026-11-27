import Link from 'next/link';
import { ClipboardList, FlaskConical, FileCheck2, TestTube2, Hourglass } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Laboratory dashboard', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['LAB_STAFF']); const d = await labService.dashboard(p);
  return <><PageHeader title="Laboratory" description="Work queue of your hospital's laboratory." actions={<Button asChild><Link href="/lab/requests">Open requests</Link></Button>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Pending requests" value={d.requested} icon={<ClipboardList className="size-5" />} tone="warn" /><StatCard label="Sample collected" value={d.collected} icon={<TestTube2 className="size-5" />} tone="info" /><StatCard label="Processing" value={d.processing} icon={<Hourglass className="size-5" />} tone="info" /><StatCard label="Completed" value={d.completed} icon={<FlaskConical className="size-5" />} tone="ok" /><StatCard label="Published reports" value={d.published} icon={<FileCheck2 className="size-5" />} tone="ok" /></div></>;
}
