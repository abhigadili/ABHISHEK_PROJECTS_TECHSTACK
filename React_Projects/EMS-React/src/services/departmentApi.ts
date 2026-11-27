import { http } from '@/api/httpClient';
import { clean } from './employeeApi';
import type { Department, DepartmentPayload, Paged, Team } from '@/types/api';

interface Envelope<T> {
  data: T;
  meta?: Paged<unknown>['meta'];
}

export const departmentApi = {
  list: async (
    query: { q?: string; isActive?: boolean; page?: number; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<Paged<Department>> => {
    const { data } = await http.get<Envelope<Department[]>>('/departments', { params: clean(query), signal });
    return { items: data.data, meta: data.meta! };
  },
  get: async (id: number) => (await http.get<Envelope<Department>>(`/departments/${id}`)).data.data,
  create: async (body: DepartmentPayload) =>
    (await http.post<Envelope<Department>>('/departments', body, { skipGlobalError: true })).data.data,
  update: async (id: number, body: DepartmentPayload) =>
    (await http.put<Envelope<Department>>(`/departments/${id}`, body, { skipGlobalError: true })).data.data,
  deactivate: (id: number) => http.delete(`/departments/${id}`),
  activate: (id: number) => http.post(`/departments/${id}/activate`),
  teams: async (departmentId: number) =>
    (await http.get<Envelope<Team[]>>('/teams', { params: { departmentId, limit: 100 } })).data.data,
};
