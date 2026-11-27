import { Skeleton } from '@/components/common/ui';
export default function Loading() { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>; }
