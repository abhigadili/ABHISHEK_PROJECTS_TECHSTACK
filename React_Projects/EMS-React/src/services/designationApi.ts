import { http } from '@/api/httpClient';
import { clean } from './employeeApi';
import type { Designation, DesignationPayload, Paged } from '@/types/api';

interface Envelope<T> {
  data: T;
  meta?: Paged<unknown>['meta'];
}

export const designationApi = {
  list: async (
    query: { q?: string; isActive?: boolean; page?: number; limit?: number } = {},
  ): Promise<Paged<Designation>> => {
    const { data } = await http.get<Envelope<Designation[]>>('/designations', { params: clean(query) });
    return { items: data.data, meta: data.meta! };
  },
  create: async (body: DesignationPayload) =>
    (await http.post<Envelope<Designation>>('/designations', body, { skipGlobalError: true })).data.data,
  update: async (id: number, body: DesignationPayload) =>
    (await http.put<Envelope<Designation>>(`/designations/${id}`, body, { skipGlobalError: true })).data.data,
};
