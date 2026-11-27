import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useListEmployeesQuery } from '@/store/api/emsApi';
import type { EmployeeListQuery, EmployeeStatus, EmploymentType } from '@/types/api';

export interface EmployeeFilters {
  q: string;
  departmentId: number | undefined;
  designationId: number | undefined;
  status: EmployeeStatus | 'ALL';
  employmentType: EmploymentType | '';
  sort: string;
  page: number;
  limit: number;
}

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** URL ⇄ filters. The URL is the single source of truth, so filters survive refresh, back/forward and shared links. */
export function parseEmployeeFilters(sp: URLSearchParams): EmployeeFilters {
  return {
    q: sp.get('q') ?? '',
    departmentId: num(sp.get('departmentId')),
    designationId: num(sp.get('designationId')),
    status: (sp.get('status') as EmployeeStatus | 'ALL') || 'ACTIVE',
    employmentType: (sp.get('employmentType') as EmploymentType) || '',
    sort: sp.get('sort') ?? 'name',
    page: num(sp.get('page')) ?? 1,
    limit: num(sp.get('limit')) ?? 10,
  };
}

export function useEmployees() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseEmployeeFilters(params), [params]);

  /** Merge a patch into the query string; any filter change except `page` resets to page 1. */
  const update = useCallback(
    (patch: Partial<Record<keyof EmployeeFilters, string | number | undefined>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (
              v === undefined ||
              v === '' ||
              (k === 'status' && v === 'ACTIVE') ||
              (k === 'sort' && v === 'name')
            )
              next.delete(k);
            else next.set(k, String(v));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const query: EmployeeListQuery = useMemo(
    () => ({
      q: filters.q || undefined,
      departmentId: filters.departmentId,
      designationId: filters.designationId,
      status: filters.status,
      employmentType: filters.employmentType || undefined,
      sort: filters.sort,
      page: filters.page,
      limit: filters.limit,
    }),
    [filters],
  );

  const result = useListEmployeesQuery(query);
  return { filters, update, query, ...result };
}
