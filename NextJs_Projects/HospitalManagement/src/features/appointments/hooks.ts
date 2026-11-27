'use client';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, doctorsApi, patientsApi } from '@/services/api/clientApis';
import { http } from '@/services/api/client';
import { keys } from '@/services/queryKeys';
import { emitToast } from '@/components/ui/toast';
import type { Appointment } from '@/types';

/** Parallel Queries (useQueries): one query per doctor, merged into one list - there is no "all appointments" endpoint in the backend. */
export function useDoctorAppointments(doctorIds: number[]) {
  return useQueries({
    queries: doctorIds.map((id) => ({ queryKey: keys.appointments.byDoctor(id), queryFn: ({ signal }: { signal: AbortSignal }) => appointmentsApi.byDoctor(id, undefined, signal), staleTime: 20_000 })),
    combine: (results) => ({ data: results.flatMap((r) => r.data ?? []), isPending: results.some((r) => r.isPending), isError: results.length > 0 && results.every((r) => r.isError), isFetching: results.some((r) => r.isFetching), refetch: () => results.forEach((r) => void r.refetch()) }),
  });
}
export const usePatientAppointments = (patientId: number | null) => useQuery({ queryKey: keys.appointments.byPatient(patientId), queryFn: ({ signal }) => appointmentsApi.byPatient(patientId!, signal), enabled: patientId !== null });

/**
 * Optimistic update: the row flips to CANCELLED immediately (onMutate), rolls back from the snapshot on error (onError) and is
 * re-synchronised with the server when the mutation settles (onSettled). Mutation lifecycle = onMutate → onSuccess|onError → onSettled.
 */
export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => (await http.delete<Appointment>(`/appointments/${id}`, { baseURL: '/api', params: { reason } })).data,
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: keys.appointments.all }); // Query Cancellation: stop in-flight refetches that would overwrite the optimistic state
      const snapshots = qc.getQueriesData<Appointment[]>({ queryKey: keys.appointments.all });
      qc.setQueriesData<Appointment[]>({ queryKey: keys.appointments.all }, (old) => Array.isArray(old) ? old.map((a) => (a.id === id ? { ...a, status: 'CANCELLED' as const } : a)) : old); // Cache Update
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSuccess: () => emitToast({ kind: 'success', text: 'Appointment cancelled' }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: keys.appointments.all }); },
  });
}

export const useDoctorList = () => useQuery({ queryKey: keys.doctors.list({ active: true }), queryFn: ({ signal }) => doctorsApi.list({ active: true }, signal), select: (p) => p.content, staleTime: 60_000 });
export const useSpecializations = () => useQuery({ queryKey: keys.doctors.specs, queryFn: ({ signal }) => doctorsApi.specializations(signal), staleTime: 10 * 60_000 });
/** Dependent + enabled query: slots are only fetched once a doctor AND a date are chosen; previous slots stay visible while a new date loads (placeholderData). */
export const useSlots = (doctorId: number | null, date: string) => useQuery({ queryKey: keys.appointments.slots(doctorId, date), queryFn: ({ signal }) => appointmentsApi.availability(doctorId!, date, signal), enabled: doctorId !== null && !!date, placeholderData: keepPreviousData, staleTime: 10_000, refetchOnWindowFocus: true });
export const usePatientSearch = (q: string) => useQuery({ queryKey: keys.patients.search(q), queryFn: ({ signal }) => patientsApi.search(q, 0, 8, signal), enabled: q.trim().length >= 2, placeholderData: keepPreviousData });
