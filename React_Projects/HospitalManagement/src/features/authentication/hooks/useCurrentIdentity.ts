import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { patientApi } from '@/services/endpoints/patientApi';
import { doctorApi } from '@/services/endpoints/doctorApi';
import { queryKeys } from '@/services/queryKeys';
import { isApiError } from '@/services/axios/errors';

/**
 * Resolves the domain profile behind the signed-in login:
 *  - PATIENT  -> GET /patients/by-user/{userId}/profile (404 = account without a patient profile yet)
 *  - DOCTOR   -> the backend has no by-user doctor endpoint, so the doctor list is searched for `userId` (TanStack Query
 *                caches the list, which the doctor directory reuses)
 */
export function useCurrentPatient() {
  const { user, role } = useAuth();
  const q = useQuery({
    queryKey: queryKeys.patients.byUser(user?.id ?? 0),
    queryFn: ({ signal }) => patientApi.byUserProfile(user!.id, signal),
    enabled: role === 'PATIENT' && !!user,
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 1,
    staleTime: 5 * 60_000,
    meta: { silent: true },
  });
  const missing = q.isError && isApiError(q.error) && q.error.status === 404;
  return { ...q, patient: q.data ?? null, missingProfile: missing };
}

export function useCurrentDoctor() {
  const { user, role } = useAuth();
  const q = useQuery({
    queryKey: queryKeys.doctors.list({ size: 100 }),
    queryFn: ({ signal }) => doctorApi.list({ size: 100 }, signal),
    enabled: role === 'DOCTOR' && !!user,
    staleTime: 5 * 60_000,
    select: (page) => page.content.find((d) => d.userId === user?.id) ?? null,
    meta: { silent: true },
  });
  return { ...q, doctor: q.data ?? null };
}
