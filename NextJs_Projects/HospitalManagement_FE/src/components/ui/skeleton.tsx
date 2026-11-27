import { cn } from '@/lib/utilities/cn';
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton h-4 w-full', className)} />;
export const CardSkeleton = ({ rows = 3 }: { rows?: number }) => <div role="status" aria-label="Loading" className="rounded-[var(--radius)] border border-line bg-surface p-5"><Skeleton className="mb-4 h-5 w-1/3" />{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="mb-2 h-4" />)}</div>;
export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => <div role="status" aria-label="Loading" className="rounded-[var(--radius)] border border-line bg-surface p-4">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="mb-3 h-8" />)}</div>;
