import { Skeleton } from '@/components/ui/Feedback';
/** Route-level loading UI shown while the search page's own data (stations) loads on first navigation. */
export default function Loading() { return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>; }
