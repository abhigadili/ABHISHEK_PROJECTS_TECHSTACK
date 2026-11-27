import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from './useApi';
import { useDebounce } from './useDebounce';
import { organizationApi } from '@/services/organizationApi';
import type { OrgNode } from '@/types/api';

/** Org chart loading, expand/collapse state and search (debounced, cancellable) — built on the generic `useApi`. */
export function useOrganization(departmentId?: number) {
  const chart = useApi((signal, dept?: number) => organizationApi.chart({ departmentId: dept }, signal), {
    immediate: true,
    args: [departmentId],
  });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term.trim(), 300);
  const search = useApi((signal, q: string) => organizationApi.search(q, signal));

  // seed: expand the roots so the first screen shows two levels
  const { data } = chart;
  useEffect(() => {
    if (data) setExpanded(new Set(data.roots.map((r) => r.id)));
  }, [data]);

  const { run: runSearch, reset: resetSearch } = search;
  useEffect(() => {
    if (debounced.length >= 2) void runSearch(debounced);
    else resetSearch();
  }, [debounced, runSearch, resetSearch]);

  const toggle = useCallback(
    (id: number) =>
      setExpanded((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  const expandAll = useCallback(() => {
    const ids = new Set<number>();
    const walk = (n: OrgNode) => {
      if (n.subordinates.length) {
        ids.add(n.id);
        n.subordinates.forEach(walk);
      }
    };
    data?.roots.forEach(walk);
    setExpanded(ids);
  }, [data]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  /** Expand every ancestor of a search hit so it becomes visible. */
  const reveal = useCallback(
    (managerChainIds: number[]) => setExpanded((prev) => new Set([...prev, ...managerChainIds])),
    [],
  );

  return useMemo(
    () => ({
      chart: chart.data,
      loading: chart.loading,
      error: chart.error,
      reload: chart.run,
      expanded,
      toggle,
      expandAll,
      collapseAll,
      reveal,
      term,
      setTerm,
      hits: search.data ?? [],
      searching: search.loading,
    }),
    [
      chart.data,
      chart.loading,
      chart.error,
      chart.run,
      expanded,
      toggle,
      expandAll,
      collapseAll,
      reveal,
      term,
      search.data,
      search.loading,
    ],
  );
}
