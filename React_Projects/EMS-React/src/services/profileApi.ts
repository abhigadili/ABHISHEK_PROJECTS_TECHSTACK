import { http } from '@/api/httpClient';
import type { Employee } from '@/types/api';

export type ProfilePatch = Partial<{
  personalEmail: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}>;

export const profileApi = {
  get: async () => (await http.get<{ data: Employee }>('/profile')).data.data,
  /** PATCH: the backend rejects any key outside ProfilePatch with a 400. */
  patch: async (body: ProfilePatch) =>
    (await http.patch<{ data: Employee }>('/profile', body, { skipGlobalError: true })).data.data,
};
