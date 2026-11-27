import { http } from '@/services/api/http';
import type { LabPriority, LabReport, LabReportInput, LabRequest, LabRequestInput, LabStatus, LabTest, LabTestInput, Page } from '@/types';

export interface LabRequestListParams {
  status?: LabStatus;
  page?: number;
  size?: number;
}

export const laboratoryApi = {
  tests: (signal?: AbortSignal) => http.get<LabTest[]>('/lab/tests', undefined, signal),
  createTest: (body: LabTestInput) => http.post<LabTest>('/lab/tests', body),
  requests: (params: LabRequestListParams, signal?: AbortSignal) => http.get<Page<LabRequest>>('/lab/requests', { ...params }, signal),
  requestsForPatient: (patientId: number, signal?: AbortSignal) => http.get<LabRequest[]>(`/lab/requests/patient/${patientId}`, undefined, signal),
  request: (id: number, signal?: AbortSignal) => http.get<LabRequest>(`/lab/requests/${id}`, undefined, signal),
  createRequest: (body: LabRequestInput & { priority?: LabPriority }) => http.post<LabRequest>('/lab/requests', body),
  setStatus: (id: number, status: LabStatus) => http.put<LabRequest>(`/lab/requests/${id}/status`, { status }),
  cancel: (id: number) => http.put<LabRequest>(`/lab/requests/${id}/cancel`),
  report: (id: number, signal?: AbortSignal) => http.get<LabReport>(`/lab/requests/${id}/report`, undefined, signal),
  submitReport: (id: number, body: LabReportInput) => http.post<LabReport>(`/lab/requests/${id}/report`, body),
  /** multipart upload with Axios (Medical Records uses the Fetch API for the same endpoint). */
  uploadAttachment: (id: number, file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return http.post<LabReport>(`/lab/requests/${id}/report/attachment`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });
  },
  /** Axios blob download. */
  downloadAttachment: (id: number) => http.get<Blob>(`/lab/requests/${id}/report/attachment`, undefined, undefined, { responseType: 'blob' }),
};
