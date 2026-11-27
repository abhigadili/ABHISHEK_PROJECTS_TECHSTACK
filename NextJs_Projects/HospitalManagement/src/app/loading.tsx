import { Skeleton } from '@/components/ui/skeleton';
/** Root Loading UI (Suspense fallback for the whole app while a top-level segment streams in). */
export default function Loading() {
  return <div role="status" aria-label="Loading" className="mx-auto max-w-5xl space-y-4 p-8"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
}
