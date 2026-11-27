'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Paged } from '@/types';

/** Paged list query for admin grids: keeps the previous page on screen while the next one loads, cancels superseded requests. */
export function useAdminList<T>(key: string, fetcher: (params: Record<string, string | number | undefined>) => Promise<Paged<T>>, filters: Record<string, string | number | undefined> = {}) {
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['admin', key, page, filters], queryFn: () => fetcher({ page, size: 10, ...filters }), placeholderData: keepPreviousData });
  return { ...q, rows: q.data?.data ?? [], meta: q.data?.meta, page, setPage };
}
