import { http } from '@/services/api/http';
import type { Department, DepartmentInput, Hospital, HospitalInput } from '@/types';

export const hospitalApi = {
  list: (signal?: AbortSignal) => http.get<Hospital[]>('/hospitals', undefined, signal),
  get: (id: number, signal?: AbortSignal) => http.get<Hospital>(`/hospitals/${id}`, undefined, signal),
  create: (body: HospitalInput) => http.post<Hospital>('/hospitals', body),
  update: (id: number, body: HospitalInput) => http.put<Hospital>(`/hospitals/${id}`, body),
  deactivate: (id: number) => http.delete(`/hospitals/${id}`),
  departments: (hospitalId: number, signal?: AbortSignal) => http.get<Department[]>(`/hospitals/${hospitalId}/departments`, undefined, signal),
  createDepartment: (hospitalId: number, body: DepartmentInput) => http.post<Department>(`/hospitals/${hospitalId}/departments`, body),
  updateDepartment: (id: number, body: DepartmentInput) => http.put<Department>(`/departments/${id}`, body),
  deleteDepartment: (id: number) => http.delete(`/departments/${id}`),
};
