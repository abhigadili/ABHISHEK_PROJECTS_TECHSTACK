import { useCallback } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientApi } from '@/services/endpoints/patientApi';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/constants/permissions';
import { queryKeys } from '@/services/queryKeys';
import type { Patient, PatientInput, PatientListParams } from '@/types';
import type { PatientFormValues } from '@/schemas/patient';
import { emptyToNull } from '@/utils/format';

/** Server-side pagination + search. `placeholderData: keepPreviousData` keeps the old page on screen while the next loads. */
export function usePatientList(params: PatientListParams) {
  return useQuery({
    queryKey: queryKeys.patients.list(params),
    queryFn: ({ signal }) => patientApi.list(params, signal),
    placeholderData: keepPreviousData,
    meta: { errorMessage: 'Could not load patients' },
  });
}

export function usePatient(id: number, enabled = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.patients.detail(id),
    queryFn: ({ signal }) => patientApi.get(id, signal),
    enabled: enabled && Number.isFinite(id) && id > 0,
    // initialData from an already-cached list page => instant render, then a background refresh because it is stale.
    initialData: () => {
      for (const [, page] of qc.getQueriesData<{ content: Patient[] }>({ queryKey: queryKeys.patients.lists() })) {
        const hit = page?.content.find((p) => p.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.patients.lists())?.dataUpdatedAt,
  });
}

/** Map form strings to the backend payload (empty optional strings -> null). */
export function toPatientInput(v: PatientFormValues): PatientInput {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    dateOfBirth: v.dateOfBirth,
    gender: v.gender,
    email: v.email.trim(),
    phone: v.phone.trim(),
    identityNumber: emptyToNull(v.identityNumber),
    bloodGroup: v.bloodGroup === '' ? null : v.bloodGroup,
    address: emptyToNull(v.address),
    emergencyContactName: emptyToNull(v.emergencyContactName),
    emergencyContactPhone: emptyToNull(v.emergencyContactPhone),
    knownAllergies: emptyToNull(v.knownAllergies),
  };
}

export function fromPatient(p: Patient): PatientFormValues {
  return {
    firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, gender: p.gender, bloodGroup: p.bloodGroup ?? '', identityNumber: p.identityNumber ?? '',
    email: p.email, phone: p.phone, address: p.address ?? '', emergencyContactName: p.emergencyContactName ?? '', emergencyContactPhone: p.emergencyContactPhone ?? '', knownAllergies: p.knownAllergies ?? '',
  };
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PatientFormValues) => patientApi.create(toPatientInput(v)),
    meta: { silent: true }, // the registration page renders server validation itself
    onSuccess: (p) => {
      qc.setQueryData(queryKeys.patients.detail(p.id), p); // Cache Updates: seed the detail cache
      // A patient who just registered was resolved as "no profile" (404) right after login: replace that cached error
      // with the new profile so /profile and the dashboard see it immediately.
      if (p.userId) qc.setQueryData(queryKeys.patients.byUser(p.userId), p);
      void qc.invalidateQueries({ queryKey: queryKeys.patients.lists() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdatePatient(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PatientFormValues) => patientApi.update(id, toPatientInput(v)),
    meta: { silent: true },
    onSuccess: (p) => {
      qc.setQueryData(queryKeys.patients.detail(id), p);
      void qc.invalidateQueries({ queryKey: queryKeys.patients.lists() });
      void qc.invalidateQueries({ queryKey: queryKeys.patients.byUser(p.userId ?? 0) });
    },
  });
}

export function useDeactivatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => patientApi.deactivate(id),
    meta: { successMessage: 'Patient deactivated', errorMessage: 'Could not deactivate patient' },
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.patients.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.patients.lists() });
    },
  });
}

/**
 * Prefetching with Promise.all: hovering a patient row warms the detail record and (if the role may read it) the
 * appointment history in parallel; the promise resolves when BOTH are cached, errors are swallowed because prefetching
 * is only an optimisation.
 */
export function usePrefetchPatient() {
  const qc = useQueryClient();
  const { role } = useAuth();
  // useCallback: a stable identity keeps the memoised <PatientRow> from re-rendering on every parent render
  return useCallback((id: number) =>
    Promise.all([
      qc.prefetchQuery({ queryKey: queryKeys.patients.detail(id), queryFn: ({ signal }) => patientApi.get(id, signal), staleTime: 60_000 }),
      can(role, 'appointments:manage') ? qc.prefetchQuery({ queryKey: queryKeys.appointments.forPatient(id), queryFn: ({ signal }) => appointmentApi.forPatient(id, signal), staleTime: 60_000 }) : Promise.resolve(),
    ]).catch(() => undefined), [qc, role]);
}
