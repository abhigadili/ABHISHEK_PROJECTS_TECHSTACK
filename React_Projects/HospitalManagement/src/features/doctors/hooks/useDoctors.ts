import { useCallback } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorApi } from '@/services/endpoints/doctorApi';
import { authApi } from '@/services/endpoints/authApi';
import { queryKeys } from '@/services/queryKeys';
import type { Doctor, DoctorInput, DoctorListParams, ISODate, ScheduleDay } from '@/types';

export function useDoctorList(params: DoctorListParams) {
  return useQuery({
    queryKey: queryKeys.doctors.list(params),
    queryFn: ({ signal }) => doctorApi.list(params, signal),
    meta: { errorMessage: 'Could not load doctors' },
  });
}

export function useSpecializations() {
  return useQuery({ queryKey: queryKeys.doctors.specializations(), queryFn: ({ signal }) => doctorApi.specializations(signal) });
}

/**
 * Query Options: key + fetcher + defaults declared ONCE with `queryOptions()` and shared by useQuery, prefetchQuery and
 * anything else that needs the same query (type-safe: `getQueryData(doctorQueryOptions(id).queryKey)` is typed as Doctor).
 */
export const doctorQueryOptions = (id: number) =>
  queryOptions({
    queryKey: queryKeys.doctors.detail(id),
    queryFn: ({ signal }) => doctorApi.get(id, signal),
    staleTime: 60_000,
  });
export const doctorScheduleQueryOptions = (id: number) =>
  queryOptions({ queryKey: queryKeys.doctors.schedule(id), queryFn: ({ signal }) => doctorApi.schedule(id, signal), staleTime: 60_000 });

export function useDoctor(id: number) {
  const qc = useQueryClient();
  return useQuery({
    ...doctorQueryOptions(id),
    enabled: Number.isFinite(id) && id > 0,
    // Placeholder data: show the cached list row immediately but do NOT persist it as real data in the cache.
    placeholderData: (): Doctor | undefined => {
      for (const [, page] of qc.getQueriesData<{ content: Doctor[] }>({ queryKey: queryKeys.doctors.lists() })) {
        const hit = page?.content.find((d) => d.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
  });
}

/** Prefetching: warm the cache on hover so the details page opens instantly. */
export function usePrefetchDoctor() {
  const qc = useQueryClient();
  return useCallback((id: number) => {
    void qc.prefetchQuery(doctorQueryOptions(id));
    void qc.prefetchQuery(doctorScheduleQueryOptions(id));
  }, [qc]);
}

export function useDoctorSchedule(id: number) {
  return useQuery({ queryKey: queryKeys.doctors.schedule(id), queryFn: ({ signal }) => doctorApi.schedule(id, signal), enabled: id > 0 });
}

export function useDoctorUnavailability(id: number) {
  return useQuery({ queryKey: queryKeys.doctors.unavailability(id), queryFn: ({ signal }) => doctorApi.unavailability(id, signal), enabled: id > 0 });
}

export function useDoctorSlots(id: number, date: ISODate | null) {
  return useQuery({
    queryKey: queryKeys.doctors.slots(id, date ?? ''),
    queryFn: ({ signal }) => doctorApi.slots(id, date!, signal),
    enabled: id > 0 && !!date,
  });
}

export interface DoctorFormInput extends DoctorInput {
  /** create a login (role DOCTOR) first and link it - sequential API calls */
  createLogin?: { username: string; password: string };
}

export function useSaveDoctor(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ createLogin, ...body }: DoctorFormInput) => {
      if (id) return doctorApi.update(id, body);
      let userId = body.userId ?? null;
      if (createLogin) {
        // Step 1 of 2: identity account with role DOCTOR (Hospital Service); step 2 links it to the doctor profile.
        const acct = await authApi.users.create({ username: createLogin.username, email: body.email, password: createLogin.password, role: 'DOCTOR' });
        userId = acct.id;
      }
      return doctorApi.create({ ...body, userId });
    },
    meta: { silent: true },
    onSuccess: (d) => {
      qc.setQueryData(queryKeys.doctors.detail(d.id), d);
      void qc.invalidateQueries({ queryKey: queryKeys.doctors.lists() });
      void qc.invalidateQueries({ queryKey: queryKeys.doctors.specializations() });
    },
  });
}

export function useDeactivateDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => doctorApi.deactivate(id),
    meta: { successMessage: 'Doctor deactivated', errorMessage: 'Could not deactivate doctor' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.doctors.all }),
  });
}

export function useSaveSchedule(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: ScheduleDay[]) => doctorApi.saveSchedule(id, days),
    meta: { successMessage: 'Weekly schedule saved', errorMessage: 'Could not save schedule' },
    onSuccess: (days) => {
      qc.setQueryData(queryKeys.doctors.schedule(id), days);
      // slot grids and appointment availability derive from the schedule
      void qc.invalidateQueries({ queryKey: [...queryKeys.doctors.all, 'slots', id] });
      void qc.invalidateQueries({ queryKey: [...queryKeys.appointments.all, 'availability'] });
      void qc.invalidateQueries({ queryKey: [...queryKeys.doctors.all, 'available'] });
    },
  });
}

export function useUnavailabilityMutations(id: number) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.doctors.unavailability(id) });
    void qc.invalidateQueries({ queryKey: [...queryKeys.doctors.all, 'slots', id] });
    void qc.invalidateQueries({ queryKey: [...queryKeys.appointments.all, 'availability'] });
    void qc.invalidateQueries({ queryKey: [...queryKeys.doctors.all, 'available'] });
  };
  const add = useMutation({
    mutationFn: (b: { date: ISODate; reason?: string | null }) => doctorApi.addUnavailability(id, b),
    meta: { successMessage: 'Day off added', errorMessage: 'Could not add day off' },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (uid: number) => doctorApi.removeUnavailability(id, uid),
    meta: { successMessage: 'Day off removed', errorMessage: 'Could not remove day off' },
    onSuccess: refresh,
  });
  return { add, remove };
}
