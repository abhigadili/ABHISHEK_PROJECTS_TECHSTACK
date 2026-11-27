import { http } from '@/api/httpClient';
import type { LeaveApplication, LeaveRequest } from '@/types/api';

interface Envelope<T> {
  data: T;
}

export const leaveApi = {
  apply: async (body: LeaveApplication) =>
    (await http.post<Envelope<LeaveRequest>>('/leave/requests', body, { skipGlobalError: true })).data.data,
  decide: async (id: number, action: 'approve' | 'reject', note?: string) =>
    (
      await http.post<Envelope<LeaveRequest>>(`/leave/requests/${id}/${action}`, note ? { note } : {}, {
        skipGlobalError: true,
      })
    ).data.data,
  cancel: async (id: number) =>
    (await http.post<Envelope<LeaveRequest>>(`/leave/requests/${id}/cancel`, {}, { skipGlobalError: true }))
      .data.data,
  /** Multipart upload of a supporting document (jpeg/png/pdf). */
  uploadDocument: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post(`/leave/requests/${id}/documents`, form, { skipGlobalError: true });
  },
  /** Binary download → the caller turns the Blob into a Save-As. */
  downloadDocument: async (id: number, docId: number) =>
    (await http.get<Blob>(`/leave/requests/${id}/documents/${docId}`, { responseType: 'blob' })).data,
};
