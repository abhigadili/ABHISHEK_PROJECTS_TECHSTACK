import { CardSkeleton } from '@/components/ui/skeleton';
export default function Loading() { return <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} rows={1} />)}</div>; }
