import { CardSkeleton } from '@/components/ui/skeleton';
export default function StatsLoading() { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} rows={1} />)}</div>; }
