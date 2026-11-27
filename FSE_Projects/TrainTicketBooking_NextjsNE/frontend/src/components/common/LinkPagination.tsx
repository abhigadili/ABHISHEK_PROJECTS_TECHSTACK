import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { PageMeta } from '@/types';

/** Pagination as plain links (Server Component): page lives in the URL, so it is shareable, back-button friendly and needs no client JS. */
export function LinkPagination({ meta, basePath, params }: { meta?: PageMeta; basePath: string; params?: Record<string, string | undefined> }) {
  if (!meta || meta.totalPages <= 1) return null;
  const href = (p: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(params ?? {})) if (v) u.set(k, v); u.set('page', String(p)); return `${basePath}?${u}`; };
  const cls = 'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700';
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Page {meta.page + 1} of {meta.totalPages} · {meta.total} records</span>
      <div className="flex gap-2">
        {meta.page > 0 ? <Link className={cls} href={href(meta.page - 1)}><ChevronLeft size={16} />Prev</Link> : <span className={`${cls} opacity-40`}><ChevronLeft size={16} />Prev</span>}
        {meta.page + 1 < meta.totalPages ? <Link className={cls} href={href(meta.page + 1)}>Next<ChevronRight size={16} /></Link> : <span className={`${cls} opacity-40`}>Next<ChevronRight size={16} /></span>}
      </div>
    </nav>
  );
}
