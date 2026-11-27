import { useCallback, useMemo, useState } from 'react';
import { env } from '@/constants/env';

export interface PaginationOptions {
  initialPage?: number;
  initialLimit?: number;
}

/** 1-based page + page size state with helpers; `props` plugs straight into MUI's TablePagination (which is 0-based). */
export function usePagination({
  initialPage = 1,
  initialLimit = env.defaultPageSize,
}: PaginationOptions = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);

  const setLimit = useCallback((n: number) => {
    setLimitState(n);
    setPage(1);
  }, []); // changing page size restarts at page 1
  const reset = useCallback(() => setPage(1), []);
  const next = useCallback(
    (totalPages: number) => setPage((p) => Math.min(p + 1, Math.max(totalPages, 1))),
    [],
  );
  const prev = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);

  return useMemo(
    () => ({ page, limit, setPage, setLimit, reset, next, prev }),
    [page, limit, setLimit, reset, next, prev],
  );
}
