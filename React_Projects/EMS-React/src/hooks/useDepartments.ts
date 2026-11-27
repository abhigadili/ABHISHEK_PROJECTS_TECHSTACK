import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setDepartmentFilter } from '@/store/slices/departmentSlice';
import { useListDepartmentsQuery, useListDesignationsQuery } from '@/store/api/emsApi';

/** Department list as select options (+ lookups) from the RTK Query cache. Many components call this; the request is shared. */
export function useDepartments(opts: { activeOnly?: boolean; skip?: boolean } = {}) {
  const { data, isLoading, isError, refetch } = useListDepartmentsQuery(
    { limit: 100, ...(opts.activeOnly ? { isActive: true } : {}) },
    { skip: opts.skip }, // lets roles that cannot use the filter avoid a pointless request
  );
  const departments = useMemo(() => data?.items ?? [], [data]);
  const options = useMemo(
    () => departments.map((d) => ({ value: String(d.id), label: d.name })),
    [departments],
  );
  const nameById = useCallback(
    (id?: number | null) => departments.find((d) => d.id === id)?.name ?? '—',
    [departments],
  );
  return { departments, options, nameById, isLoading, isError, refetch };
}

export function useDesignations() {
  const { data, isLoading } = useListDesignationsQuery({ limit: 100 });
  const designations = useMemo(() => data?.items ?? [], [data]);
  const options = useMemo(
    () =>
      designations
        .filter((d) => d.isActive)
        .map((d) => ({ value: String(d.id), label: `${d.name} (L${d.jobLevel})` })),
    [designations],
  );
  return { designations, options, isLoading };
}

/** The department filter that follows the user across screens (Redux `departments.filterId`). */
export function useDepartmentFilter() {
  const dispatch = useAppDispatch();
  const departmentId = useAppSelector((s) => s.departments.filterId);
  const set = useCallback(
    (id: number | null) => {
      dispatch(setDepartmentFilter(id));
    },
    [dispatch],
  );
  return [departmentId, set] as const;
}
