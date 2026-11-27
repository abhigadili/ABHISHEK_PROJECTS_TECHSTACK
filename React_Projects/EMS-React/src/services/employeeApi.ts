import { http } from '@/api/httpClient';
import type { Employee, EmployeeListQuery, EmployeePayload, JobHistoryEntry, Paged } from '@/types/api';
import type { Role } from '@/constants/roles';

interface Envelope<T> {
  data: T;
  meta?: Paged<unknown>['meta'];
}

/** Drop undefined/empty values so they never become `?q=` noise or `null` bodies (the backend 500s on workLocation:null). */
export const clean = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as Partial<T>;

export const employeeApi = {
  list: async (query: EmployeeListQuery = {}, signal?: AbortSignal): Promise<Paged<Employee>> => {
    const { data } = await http.get<Envelope<Employee[]>>('/employees', { params: clean(query), signal });
    return { items: data.data, meta: data.meta! };
  },
  get: async (id: number, signal?: AbortSignal) =>
    (await http.get<Envelope<Employee>>(`/employees/${id}`, { signal })).data.data,
  create: async (body: EmployeePayload) =>
    (await http.post<Envelope<Employee>>('/employees', body, { skipGlobalError: true })).data.data,
  update: async (id: number, body: EmployeePayload) =>
    (await http.put<Envelope<Employee>>(`/employees/${id}`, body, { skipGlobalError: true })).data.data,
  patch: async (id: number, body: EmployeePayload) =>
    (await http.patch<Envelope<Employee>>(`/employees/${id}`, body, { skipGlobalError: true })).data.data,
  deactivate: (id: number, body: { reason?: string; exitDate?: string; reassignReportsTo?: number }) =>
    http.post(`/employees/${id}/deactivate`, body),
  reactivate: (id: number) => http.post(`/employees/${id}/reactivate`),
  jobHistory: async (id: number) =>
    (await http.get<Envelope<JobHistoryEntry[]>>(`/employees/${id}/job-history`)).data.data,
  createAccount: (id: number, body: { role: Role; password: string }) =>
    http.post(`/employees/${id}/account`, body, { skipGlobalError: true }),
  setRole: (id: number, role: Role) => http.put(`/employees/${id}/role`, { role }),

  /** Profile pictures are bearer-protected, so they are fetched as Blobs (an <img src> cannot send Authorization). */
  picture: async (id: number | 'me', signal?: AbortSignal): Promise<Blob | null> => {
    try {
      const url = id === 'me' ? '/profile/picture' : `/employees/${id}/picture`;
      return (await http.get<Blob>(url, { responseType: 'blob', signal, skipGlobalError: true })).data;
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
  /** Multipart upload: the field name is `file` (backend: multer.single('file')). */
  uploadPicture: (id: number | 'me', file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    const url = id === 'me' ? '/profile/picture' : `/employees/${id}/picture`;
    return http.put(url, form, {
      skipGlobalError: true,
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? file.size))),
    });
  },
  deletePicture: (id: number | 'me') =>
    http.delete(id === 'me' ? '/profile/picture' : `/employees/${id}/picture`),
};
