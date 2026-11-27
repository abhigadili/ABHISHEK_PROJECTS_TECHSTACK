import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@/types';
import { Button } from './Button';
export const Pagination = ({ meta, onPage }: { meta?: PageMeta; onPage: (p: number) => void }) => !meta || meta.totalPages <= 1 ? null : (
  <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
    <span>Page {meta.page + 1} of {meta.totalPages} · {meta.total} records</span>
    <div className="flex gap-2"><Button size="sm" variant="outline" disabled={meta.page === 0} onClick={() => onPage(meta.page - 1)}><ChevronLeft size={16} />Prev</Button><Button size="sm" variant="outline" disabled={meta.page + 1 >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight size={16} /></Button></div>
  </div>
);
