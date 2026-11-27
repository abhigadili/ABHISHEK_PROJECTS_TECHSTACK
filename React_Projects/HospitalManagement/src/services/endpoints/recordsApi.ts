import { fetchBlob, fetchJson } from '@/services/api/fetchClient';
import type { LabReport, Page, RecordEntry, RecordEntryInput, RecordEntryType, RecordSummary } from '@/types';

/**
 * Medical Records Service client written on the Fetch API (module requirement: "Fetch API" lives here).
 * Lab report attachments are the only documents the backend stores, so document upload/download goes through
 * /lab/requests/{id}/report/attachment but is driven from this module.
 */
export const recordsApi = {
  entries: (patientId: number, params: { type?: RecordEntryType; page?: number; size?: number }, signal?: AbortSignal) =>
    fetchJson<Page<RecordEntry>>(`/records/patients/${patientId}/entries`, { query: { ...params }, signal }),
  entry: (id: number, signal?: AbortSignal) => fetchJson<RecordEntry>(`/records/entries/${id}`, { signal }),
  summary: (patientId: number, signal?: AbortSignal) => fetchJson<RecordSummary>(`/records/patients/${patientId}/summary`, { signal }),
  createEntry: (body: RecordEntryInput) => fetchJson<RecordEntry>('/records/entries', { method: 'POST', body }),
  updateEntry: (id: number, body: { title: string; details?: string | null }) => fetchJson<RecordEntry>(`/records/entries/${id}`, { method: 'PUT', body }),
  setConditions: (patientId: number, chronicConditions: string | null) =>
    fetchJson<RecordSummary>(`/records/patients/${patientId}/conditions`, { method: 'PUT', body: { chronicConditions } }),
  labReport: (requestId: number, signal?: AbortSignal) => fetchJson<LabReport>(`/lab/requests/${requestId}/report`, { signal }),
  uploadDocument: (requestId: number, file: File, signal?: AbortSignal) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetchJson<LabReport>(`/lab/requests/${requestId}/report/attachment`, { method: 'POST', formData: fd, signal });
  },
  downloadDocument: (requestId: number, signal?: AbortSignal) => fetchBlob(`/lab/requests/${requestId}/report/attachment`, { signal }),
};
