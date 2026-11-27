import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';

/** Server-rendered pagination that keeps every other search param (URL state). */
export function Pagination({ page, totalPages, total, basePath, params }: { page: number; totalPages: number; total?: number; basePath: string; params?: Record<string, string | undefined> }) {
  if (totalPages <= 1 && !total) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
    if (p > 0) sp.set('page', String(p));
    return `${basePath}${sp.size ? `?${sp}` : ''}`;
  };
  const item = 'inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm';
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="text-muted num">{total !== undefined ? `${total} result${total === 1 ? '' : 's'} · ` : ''}Page {page + 1} of {Math.max(totalPages, 1)}</span>
      <div className="flex gap-2">
        {page > 0 ? <Link href={href(page - 1)} className={cn(item, 'hover:bg-surface2')}><ChevronLeft className="size-4" />Prev</Link> : <span className={cn(item, 'opacity-40')}><ChevronLeft className="size-4" />Prev</span>}
        {page + 1 < totalPages ? <Link href={href(page + 1)} className={cn(item, 'hover:bg-surface2')}>Next<ChevronRight className="size-4" /></Link> : <span className={cn(item, 'opacity-40')}>Next<ChevronRight className="size-4" /></span>}
      </div>
    </nav>
  );
}
