import Link from 'next/link';
import { withParams, type RawSearchParams } from '@/lib/utils/search-params';
import type { PageMeta } from '@/schemas/api';
import { buttonClass } from './ui';

/** Server Component: plain <a> links that keep every other filter in the URL (shareable, crawlable, works without JavaScript). */
export function Pagination({ base, meta, params }: { base: string; meta: PageMeta; params: RawSearchParams }) {
  if (meta.totalPages <= 1) return <p className="mt-3 text-sm text-muted">{meta.total} result{meta.total === 1 ? '' : 's'}</p>;
  const prev = meta.page > 1; const next = meta.page < meta.totalPages;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">Page {meta.page} of {meta.totalPages} · {meta.total} results</span>
      <span className="flex gap-2">
        {prev ? <Link className={buttonClass('secondary')} rel="prev" href={withParams(base, params, { page: meta.page - 1 })}>Previous</Link> : <span className={buttonClass('secondary', 'opacity-50')} aria-disabled>Previous</span>}
        {next ? <Link className={buttonClass('secondary')} rel="next" href={withParams(base, params, { page: meta.page + 1 })}>Next</Link> : <span className={buttonClass('secondary', 'opacity-50')} aria-disabled>Next</span>}
      </span>
    </nav>
  );
}
