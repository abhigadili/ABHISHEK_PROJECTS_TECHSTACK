import { Skeleton } from '@/components/common/ui';
/** Suspense fallback for every tab of /employees/[id] while its server data streams in. */
export default function Loading() { return <div className="space-y-3" aria-busy><Skeleton className="h-8 w-48" /><Skeleton className="h-48" /></div>; }
