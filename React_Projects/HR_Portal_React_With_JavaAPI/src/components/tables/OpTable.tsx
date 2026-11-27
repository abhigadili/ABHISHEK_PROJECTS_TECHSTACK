import { useMemo, useState, type ReactNode } from 'react';
import { OPERATION_MAP } from '@/api/client/call';
import { useOp } from '@/components/op/useOp';
import { useDebounced } from '@/hooks/useDebounced';
import { DataTable, type Col, type DataTableProps } from './DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import { ErrorState } from '@/components/feedback/states';
import { useTranslation } from 'react-i18next';

export interface OpTableProps<T = any> extends Omit<DataTableProps<T>, 'rows' | 'paging' | 'sorting' | 'search' | 'loading' | 'error' | 'id'> {
  op: string; path?: Record<string, string | number>; query?: Record<string, unknown>;
  tableId?: string; /** query-param name used for the search box (e.g. 'q'); omit for no search */ searchParam?: string;
  /** columns the backend allows sorting on (the allow-list differs per endpoint) */ sortable?: string[];
  columns?: Col<T>[]; pick?: (data: any) => any[]; enabled?: boolean; defaultSort?: string; refetchInterval?: number;
  /** extra UI beside the search box */ filters?: ReactNode;
  /** rendered instead of the table when the backend answers 5xx (graceful degradation) */ fallback?: ReactNode;
}

/** Table bound to one GET operation. Handles PageResponse (server paging/sorting/search) and plain arrays (client side). */
export function OpTable<T extends Record<string, any> = any>({ op: opId, path, query, tableId, searchParam, sortable, columns, pick, enabled, defaultSort, refetchInterval, filters, toolbar, fallback, ...rest }: OpTableProps<T>) {
  const op = OPERATION_MAP[opId];
  const { canCall } = usePermissions();
  const { t } = useTranslation();
  const paged = op.query.some((q) => q.name === 'page');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState<string | undefined>(defaultSort);
  const [search, setSearch] = useState('');
  const dq = useDebounced(search, 350);
  const ctx = useMemo(() => ({ path, query: { ...(query ?? {}), ...(paged ? { page, size, sort } : {}), ...(searchParam && dq ? { [searchParam]: dq } : {}) } }), [path, query, paged, page, size, sort, searchParam, dq]);
  const q = useOp<any>(opId, ctx, { enabled: enabled !== false && canCall(opId), placeholderData: (prev: any) => prev, refetchInterval });
  if (!canCall(opId)) return <div className="hr-card"><ErrorState error={new Error(t('common.notAuthorized'))} /></div>;
  if (fallback && q.isError && ((q.error as any)?.status ?? 0) >= 500) return <>{fallback}</>;
  const data = q.data;
  const rows: T[] = pick ? pick(data) : Array.isArray(data) ? data : data?.content ?? [];
  const cols = columns?.map((c) => (sortable && paged ? { ...c, sortable: sortable.includes(c.key) } : c));
  return (
    <DataTable<T> id={tableId ?? opId} rows={rows} columns={cols} loading={q.isLoading} error={q.isError ? q.error : undefined} onRetry={() => q.refetch()} exportName={rest.exportName ?? opId}
      paging={paged && data && !Array.isArray(data) ? { page: data.page ?? page, size: data.size ?? size, total: data.totalElements ?? rows.length, totalPages: data.totalPages ?? 1, onPage: setPage, onSize: (s) => { setSize(s); setPage(0); } } : undefined}
      sorting={paged ? { sort, onSort: (s) => { setSort(s); setPage(0); } } : undefined}
      search={searchParam ? { value: search, onChange: (v) => { setSearch(v); setPage(0); } } : undefined}
      toolbar={<>{filters}{toolbar}</>} {...rest} />
  );
}
