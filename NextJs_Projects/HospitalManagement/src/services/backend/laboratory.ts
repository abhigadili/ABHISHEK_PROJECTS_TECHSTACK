import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import { CACHE_TAGS } from '@/constants/cache';
import type { LabReport, LabReportInput, LabRequest, LabRequestInput, LabStatus, LabTest, Page } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
export const labService = {
  tests: () => backendFetch<LabTest[]>('/api/lab/tests', { revalidate: 300, tags: [CACHE_TAGS.labReports + '-catalogue'] }),
  requests: (p: { status?: string; page?: number; size?: number } = {}) => backendFetch<Page<LabRequest>>('/api/lab/requests', { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  request: (id: number) => backendFetch<LabRequest>(`/api/lab/requests/${id}`, { cache: 'no-store' }),
  byPatient: (patientId: number) => backendFetch<LabRequest[]>(`/api/lab/requests/patient/${patientId}`, { cache: 'no-store' }),
  create: (b: LabRequestInput) => backendFetch<LabRequest>('/api/lab/requests', { method: 'POST', body: b, ...A }),
  setStatus: (id: number, status: LabStatus) => backendFetch<LabRequest>(`/api/lab/requests/${id}/status`, { method: 'PUT', body: { status }, ...A }),
  cancel: (id: number) => backendFetch<LabRequest>(`/api/lab/requests/${id}/cancel`, { method: 'PUT', ...A }),
  report: (id: number) => backendFetch<LabReport>(`/api/lab/requests/${id}/report`, { cache: 'no-store' }),
  createReport: (id: number, b: LabReportInput) => backendFetch<LabReport>(`/api/lab/requests/${id}/report`, { method: 'POST', body: b, ...A }),
};
