'use client';
import { useEffect, useState } from 'react';
import { getJson } from '@/lib/client/fetcher';
import { useDebounce } from './useDebounce';
import type { Employee } from '@/schemas/api';

export interface EmployeeHit { id: number; fullName: string; employeeCode: string; jobTitle: string | null; department: string | null }
interface Result { forQuery: string; hits: EmployeeHit[]; error: string | null }

/**
 * Debounced, cancellable employee search against the BFF route handler (typeahead pickers). Stale requests are aborted.
 * `loading` is DERIVED (a query has no result yet) instead of being set synchronously inside the effect.
 */
export function useEmployeeSearch(term: string, limit = 8) {
  const q = useDebounce(term.trim(), 300);
  const [result, setResult] = useState<Result>({ forQuery: '', hits: [], error: null });
  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    getJson<{ items: Employee[] }>(`/api/employees?search=${encodeURIComponent(q)}&limit=${limit}`, ctrl.signal)
      .then((r) => setResult({ forQuery: q, error: null, hits: r.items.map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, jobTitle: e.jobTitle, department: e.department?.name ?? null })) }))
      .catch((e: unknown) => { if ((e as { name?: string }).name !== 'AbortError') setResult({ forQuery: q, hits: [], error: e instanceof Error ? e.message : 'Search failed' }); });
    return () => ctrl.abort(); // cleanup: a newer keystroke or unmount cancels the in-flight request
  }, [q, limit]);
  if (q.length < 2) return { hits: [] as EmployeeHit[], loading: false, error: null };
  return { hits: result.forQuery === q ? result.hits : [], loading: result.forQuery !== q, error: result.forQuery === q ? result.error : null };
}
