import { http } from '@/api/httpClient';
import type { OrgChart, OrgNode, OrgSearchHit, ReportingChain } from '@/types/api';

interface Envelope<T> {
  data: T;
}

export const organizationApi = {
  chart: async (params: { depth?: number; departmentId?: number } = {}, signal?: AbortSignal) =>
    (await http.get<Envelope<OrgChart>>('/org-chart', { params, signal })).data.data,
  search: async (q: string, signal?: AbortSignal) =>
    (await http.get<Envelope<OrgSearchHit[]>>('/org-chart/search', { params: { q }, signal })).data.data,
  directReports: async (id: number, signal?: AbortSignal) =>
    (await http.get<Envelope<OrgNode[]>>(`/org-chart/employees/${id}/direct-reports`, { signal })).data.data,
  reportingChain: async (id: number, signal?: AbortSignal) =>
    (await http.get<Envelope<ReportingChain>>(`/org-chart/employees/${id}/reporting-chain`, { signal })).data
      .data,
};
