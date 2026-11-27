import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { hospitalApi } from '@/services/endpoints/hospitalApi';
import { queryKeys } from '@/services/queryKeys';
import type { Department, DepartmentInput, Hospital, HospitalInput } from '@/types';

export function useHospitals() {
  return useQuery({
    queryKey: queryKeys.hospitals.list(),
    queryFn: ({ signal }) => hospitalApi.list(signal),
    meta: { errorMessage: 'Could not load hospitals' },
  });
}

export function useHospital(id: number | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.hospitals.detail(id ?? 0),
    queryFn: ({ signal }) => hospitalApi.get(id!, signal),
    enabled: id !== null && id > 0, // Enabled query: nothing is fetched until an id exists
    initialData: () => qc.getQueryData<Hospital[]>(queryKeys.hospitals.list())?.find((h) => h.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.hospitals.list())?.dataUpdatedAt,
  });
}

/** Dependent query: departments can only be requested once a hospital id is known. */
export function useDepartments(hospitalId: number | null) {
  return useQuery({
    queryKey: queryKeys.hospitals.departments(hospitalId ?? 0),
    queryFn: ({ signal }) => hospitalApi.departments(hospitalId!, signal),
    enabled: hospitalId !== null && hospitalId > 0,
  });
}

/**
 * Dynamic parallel queries: the number of queries depends on how many hospitals exist, so `useQueries` is used with a
 * list built at render time. The combined result is a department-id -> {name, hospital} directory shared by the
 * doctor filters, the doctor cards and the hospital pages.
 */
export function useDepartmentDirectory() {
  const hospitals = useHospitals();
  const list = hospitals.data ?? [];
  const results = useQueries({
    queries: list.map((h) => ({ queryKey: queryKeys.hospitals.departments(h.id), queryFn: ({ signal }: { signal: AbortSignal }) => hospitalApi.departments(h.id, signal) })),
  });
  const loaded = results.map((r) => r.data).join('|'); // cheap change signature
  const directory = useMemo(() => {
    const map = new Map<number, { department: Department; hospital: Hospital }>();
    results.forEach((r, i) => r.data?.forEach((d) => map.set(d.id, { department: d, hospital: list[i] as Hospital })));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, list.length]);
  return { directory, hospitals: list, isLoading: hospitals.isPending || results.some((r) => r.isPending) };
}

export function useSaveHospital(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HospitalInput) => (id ? hospitalApi.update(id, body) : hospitalApi.create(body)),
    meta: { silent: true },
    onSuccess: (h) => {
      qc.setQueryData(queryKeys.hospitals.detail(h.id), h);
      void qc.invalidateQueries({ queryKey: queryKeys.hospitals.list() });
    },
  });
}

export function useDeactivateHospital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => hospitalApi.deactivate(id),
    meta: { successMessage: 'Hospital deactivated', errorMessage: 'Could not deactivate hospital' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.hospitals.all }),
  });
}

export function useSaveDepartment(hospitalId: number, departmentId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DepartmentInput) => (departmentId ? hospitalApi.updateDepartment(departmentId, body) : hospitalApi.createDepartment(hospitalId, body)),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.hospitals.departments(hospitalId) }),
  });
}

export function useDeleteDepartment(hospitalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => hospitalApi.deleteDepartment(id),
    meta: { successMessage: 'Department removed', errorMessage: 'Could not remove department' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.hospitals.departments(hospitalId) }),
  });
}
