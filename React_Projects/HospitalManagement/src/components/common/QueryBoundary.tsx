import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

interface Props<T> {
  query: Pick<UseQueryResult<T>, 'data' | 'isPending' | 'isError' | 'error' | 'refetch' | 'isFetching' | 'isPlaceholderData'>;
  /** Render prop: receives the resolved (non-empty) data. */
  children: (data: T) => ReactNode;
  /** Decide whether `data` counts as empty. Defaults to empty arrays / empty `content`. */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  skeleton?: ReactNode;
  rows?: number;
}

const defaultIsEmpty = (d: unknown) => (Array.isArray(d) ? d.length === 0 : !!d && typeof d === 'object' && 'content' in d && Array.isArray((d as { content: unknown[] }).content) && (d as { content: unknown[] }).content.length === 0);

/**
 * Render-props component that gives every data view the same loading / error / empty handling.
 * Loading -> skeleton, error -> ErrorState with retry, empty -> EmptyState, otherwise children(data).
 */
export function QueryBoundary<T>({ query, children, isEmpty = defaultIsEmpty, empty, emptyTitle = 'Nothing here yet', emptyDescription, skeleton, rows = 4 }: Props<T>) {
  if (query.isPending) {
    return (
      <>
        {skeleton ?? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
      </>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data as T;
  if (isEmpty(data)) return <>{empty ?? <EmptyState title={emptyTitle} description={emptyDescription} />}</>;
  return <>{children(data)}</>;
}
