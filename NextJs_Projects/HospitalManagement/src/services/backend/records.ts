import 'server-only';
import { backendFetch, backendResponse } from '@/lib/api/backend';
import type { Page, RecordEntry, RecordEntryInput, RecordSummary } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
export const recordsService = {
  entries: (patientId: number, p: { type?: string; page?: number; size?: number } = {}) => backendFetch<Page<RecordEntry>>(`/api/records/patients/${patientId}/entries`, { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  entry: (id: number) => backendFetch<RecordEntry>(`/api/records/entries/${id}`, { cache: 'no-store' }),
  summary: (patientId: number) => backendFetch<RecordSummary>(`/api/records/patients/${patientId}/summary`, { cache: 'no-store' }),
  create: (b: RecordEntryInput) => backendFetch<RecordEntry>('/api/records/entries', { method: 'POST', body: b, ...A }),
  update: (id: number, b: { title: string; details?: string | null }) => backendFetch<RecordEntry>(`/api/records/entries/${id}`, { method: 'PUT', body: b, ...A }),
  setConditions: (patientId: number, chronicConditions: string) => backendFetch<unknown>(`/api/records/patients/${patientId}/conditions`, { method: 'PUT', body: { chronicConditions }, ...A }),
  attachment: (requestId: number) => backendResponse(`/api/lab/requests/${requestId}/report/attachment`, { cache: 'no-store' }),
};
