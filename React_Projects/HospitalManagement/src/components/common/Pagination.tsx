import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Pagination control for zero-based server pages (and reusable for client-side pages). */
export function Pagination({ page, totalPages, totalElements, onPageChange, disabled, label = 'results' }: { page: number; totalPages: number; totalElements?: number; onPageChange: (p: number) => void; disabled?: boolean; label?: string }) {
  if (totalPages <= 1 && totalElements === undefined) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted">{totalElements !== undefined ? `${totalElements} ${label}` : ''}{totalPages > 0 ? ` · page ${page + 1} of ${totalPages}` : ''}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={disabled || page + 1 >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
