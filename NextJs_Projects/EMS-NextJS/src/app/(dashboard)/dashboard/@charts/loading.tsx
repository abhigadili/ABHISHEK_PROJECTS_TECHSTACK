import { Skeleton } from '@/components/common/ui';
export default function Loading() { return <div className="grid gap-4 lg:grid-cols-2" aria-busy><Skeleton className="h-72" /><Skeleton className="h-72" /></div>; }
