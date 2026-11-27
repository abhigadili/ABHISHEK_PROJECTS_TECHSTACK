import { CardSkeleton, Skeleton } from '@/components/ui/skeleton';
/** Loading UI for the whole (dashboard) group: shown instantly while the destination segment streams. */
export default function DashboardLoading() {
  return <div className="space-y-4"><Skeleton className="h-8 w-56" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><CardSkeleton rows={1} /><CardSkeleton rows={1} /><CardSkeleton rows={1} /><CardSkeleton rows={1} /></div><CardSkeleton rows={5} /></div>;
}
