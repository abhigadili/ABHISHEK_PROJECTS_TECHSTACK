import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prescriptionApi } from '@/services/endpoints/prescriptionApi';
import { pharmacyApi } from '@/services/endpoints/pharmacyApi';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/constants/permissions';
import type { Prescription, PrescriptionInput } from '@/types';

export function usePatientPrescriptions(patientId: number) {
  return useQuery({ queryKey: queryKeys.prescriptions.forPatient(patientId), queryFn: ({ signal }) => prescriptionApi.forPatient(patientId, signal), enabled: patientId > 0, meta: { errorMessage: 'Could not load prescriptions' } });
}
export function useDoctorPrescriptions(doctorId: number) {
  return useQuery({ queryKey: queryKeys.prescriptions.forDoctor(doctorId), queryFn: ({ signal }) => prescriptionApi.forDoctor(doctorId, signal), enabled: doctorId > 0, meta: { errorMessage: 'Could not load prescriptions' } });
}

export function usePrescription(id: number) {
  const qc = useQueryClient();
  return useQuery<Prescription>({
    queryKey: queryKeys.prescriptions.detail(id),
    queryFn: ({ signal }) => prescriptionApi.get(id, signal),
    enabled: id > 0,
    initialData: () => {
      for (const [, list] of qc.getQueriesData<Prescription[]>({ queryKey: queryKeys.prescriptions.all })) {
        const hit = Array.isArray(list) ? list.find((p) => p.id === id) : undefined;
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.prescriptions.all)?.dataUpdatedAt,
  });
}

/** Status is changed asynchronously by the pharmacy (Kafka) - poll it while the prescription is still ACTIVE. */
export function usePrescriptionStatus(id: number, active: boolean) {
  return useQuery({ queryKey: queryKeys.prescriptions.status(id), queryFn: ({ signal }) => prescriptionApi.status(id, signal), enabled: id > 0 && active, refetchInterval: active ? 10_000 : false, meta: { silent: true } });
}

/** Medicine names for form suggestions - only for roles allowed to read the pharmacy catalogue (ADMIN, DOCTOR, PHARMACIST). */
export function useMedicineSuggestions() {
  const { role } = useAuth();
  return useQuery({ queryKey: queryKeys.pharmacy.medicines(), queryFn: ({ signal }) => pharmacyApi.medicines(signal), enabled: can(role, 'pharmacy:access'), staleTime: 5 * 60_000, meta: { silent: true }, select: (m) => m.filter((x) => x.active) });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: PrescriptionInput) => prescriptionApi.create(b),
    meta: { silent: true },
    onSuccess: (p) => {
      qc.setQueryData(queryKeys.prescriptions.detail(p.id), p);
      void qc.invalidateQueries({ queryKey: queryKeys.prescriptions.forPatient(p.patientId) });
      void qc.invalidateQueries({ queryKey: queryKeys.prescriptions.forDoctor(p.doctorId) });
      void qc.invalidateQueries({ queryKey: queryKeys.records.all }); // Kafka adds a timeline entry
      void qc.invalidateQueries({ queryKey: queryKeys.pharmacy.all }); // and a pharmacy order
    },
  });
}

export function useCancelPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => prescriptionApi.cancel(id),
    meta: { successMessage: 'Prescription cancelled', errorMessage: 'Could not cancel prescription' },
    onSuccess: (p) => {
      qc.setQueryData(queryKeys.prescriptions.detail(p.id), p);
      void qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all });
    },
  });
}
