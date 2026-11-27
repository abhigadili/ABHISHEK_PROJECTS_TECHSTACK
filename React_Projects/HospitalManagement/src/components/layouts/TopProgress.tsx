import { useIsFetching, useIsMutating } from '@tanstack/react-query';

/** Global activity indicator driven by TanStack Query (useIsFetching / useIsMutating). Hidden for silent background polling. */
export function TopProgress() {
  const fetching = useIsFetching({ predicate: (q) => !q.meta?.silent });
  const mutating = useIsMutating();
  if (!fetching && !mutating) return null;
  return (
    <div className="hms-progress no-print" role="progressbar" aria-label="Loading data">
      <div />
    </div>
  );
}
