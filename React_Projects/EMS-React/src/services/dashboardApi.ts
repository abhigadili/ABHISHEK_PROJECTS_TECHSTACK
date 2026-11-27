import { http } from '@/api/httpClient';
import type { DashboardData } from '@/types/api';

export const dashboardApi = {
  get: async (signal?: AbortSignal) =>
    (await http.get<{ data: DashboardData }>('/dashboard', { signal, skipGlobalError: true })).data.data,
};
