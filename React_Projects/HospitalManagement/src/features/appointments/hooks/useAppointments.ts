import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { doctorApi } from '@/services/endpoints/doctorApi';
import { queryKeys } from '@/services/queryKeys';
import { mutationKeys } from '@/app/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentDoctor, useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import type { Appointment, BookAppointmentRequest, ISODate, RescheduleRequest } from '@/types';

export interface AppointmentFeed {
  data: Appointment[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  isFetching: boolean;
  scopeLabel: string;
}

/**
 * Role-aware appointment feed. The backend has no "all appointments" endpoint, so:
 *   PATIENT -> dependent query: own patient profile first, then /appointments/patient/{id}
 *   DOCTOR  -> dependent query: own doctor profile first, then /appointments/doctor/{id}
 *   ADMIN   -> dynamic parallel queries: the doctor list, then one /appointments/doctor/{id} per doctor (useQueries)
 */
export function useAppointmentFeed(): AppointmentFeed {
  const { role } = useAuth();
  const me = useCurrentPatient();
  const myDoctor = useCurrentDoctor();
  const doctors = useQuery({ queryKey: queryKeys.doctors.list({ size: 100 }), queryFn: ({ signal }) => doctorApi.list({ size: 100 }, signal), enabled: role === 'ADMIN', staleTime: 5 * 60_000 });

  const patientId = role === 'PATIENT' ? me.patient?.id : undefined;
  const doctorIds = useMemo(() => (role === 'ADMIN' ? (doctors.data?.content ?? []).map((d) => d.id) : role === 'DOCTOR' && myDoctor.doctor ? [myDoctor.doctor.id] : []), [role, doctors.data, myDoctor.doctor]);

  const patientQ = useQuery({ queryKey: queryKeys.appointments.forPatient(patientId ?? 0), queryFn: ({ signal }) => appointmentApi.forPatient(patientId!, signal), enabled: !!patientId });
  const doctorQs = useQueries({ queries: doctorIds.map((id) => ({ queryKey: queryKeys.appointments.forDoctor(id), queryFn: ({ signal }: { signal: AbortSignal }) => appointmentApi.forDoctor(id, undefined, signal) })) });

  const data = useMemo(() => (role === 'PATIENT' ? (patientQ.data ?? []) : doctorQs.flatMap((q) => q.data ?? [])), [role, patientQ.data, doctorQs]);

  if (role === 'PATIENT') {
    return { data, isPending: me.isPending || (!!patientId && patientQ.isPending), isError: patientQ.isError || (me.isError && !me.missingProfile), error: patientQ.error ?? me.error, refetch: () => void patientQ.refetch(), isFetching: patientQ.isFetching, scopeLabel: 'Your appointments' };
  }
  const pending = role === 'ADMIN' ? doctors.isPending || doctorQs.some((q) => q.isPending) : myDoctor.isPending || (doctorIds.length > 0 && doctorQs.some((q) => q.isPending));
  const failed = doctorQs.find((q) => q.isError);
  return { data, isPending: pending, isError: !!failed || doctors.isError, error: failed?.error ?? doctors.error, refetch: () => doctorQs.forEach((q) => void q.refetch()), isFetching: doctorQs.some((q) => q.isFetching), scopeLabel: role === 'ADMIN' ? 'All doctors' : 'Your patients' };
}

export function useAppointment(id: number) {
  const qc = useQueryClient();
  return useQuery<Appointment>({
    queryKey: queryKeys.appointments.detail(id),
    queryFn: ({ signal }) => appointmentApi.get(id, signal),
    enabled: id > 0,
    // Initial data: reuse the row already loaded in any cached list
    initialData: () => {
      for (const [, list] of qc.getQueriesData<Appointment[]>({ queryKey: queryKeys.appointments.lists() })) {
        const hit = Array.isArray(list) ? list.find((a) => a.id === id) : undefined;
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.appointments.lists())?.dataUpdatedAt,
  });
}

/** Availability for one doctor+date (appointment service view: booked slots are `available: false`). */
export function useAvailability(doctorId: number | null, date: ISODate | null) {
  return useQuery({
    queryKey: queryKeys.appointments.availability(doctorId ?? 0, date ?? ''),
    queryFn: ({ signal }) => appointmentApi.availability(doctorId!, date!, signal),
    enabled: !!doctorId && !!date, // dependent query: waits for both selections
    // Query cancellation: switching date/doctor aborts the previous request through `signal`.
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: BookAppointmentRequest) => appointmentApi.book(b),
    meta: { silent: true },
    onSuccess: (appt) => {
      qc.setQueryData(queryKeys.appointments.detail(appt.id), appt);
      // Query invalidation: everything derived from bookings
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.lists() });
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.availability(appt.doctorId, appt.date) });
      void qc.invalidateQueries({ queryKey: queryKeys.doctors.slots(appt.doctorId, appt.date) });
      void qc.invalidateQueries({ queryKey: [...queryKeys.doctors.all, 'available'] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      // the consultation bill is created asynchronously (Kafka) - refresh billing + notifications shortly
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.billing.all });
        void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
        void qc.invalidateQueries({ queryKey: queryKeys.appointments.detail(appt.id) });
      }, 2500);
    },
  });
}

export function useRescheduleAppointment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: RescheduleRequest) => appointmentApi.reschedule(id, b),
    meta: { silent: true },
    onSuccess: (appt) => {
      qc.setQueryData(queryKeys.appointments.detail(id), appt);
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.lists() });
      void qc.invalidateQueries({ queryKey: [...queryKeys.appointments.all, 'availability'] });
      void qc.invalidateQueries({ queryKey: [...queryKeys.doctors.all, 'slots'] });
    },
  });
}

/** Optimistic cancellation is registered once as a mutation default (see app/queryClient.ts) and reused here by key. */
export function useCancelAppointment() {
  return useMutation<Appointment, Error, { id: number; reason?: string }>({ mutationKey: mutationKeys.cancelAppointment });
}

export function useCompleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => appointmentApi.complete(id, notes),
    meta: { successMessage: 'Appointment marked as completed', errorMessage: 'Could not complete appointment' },
    onSuccess: (a) => {
      qc.setQueryData(queryKeys.appointments.detail(a.id), a);
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.lists() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
