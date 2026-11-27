import 'server-only';
import { apiFetch } from './api-client';
import { orgChartSchema, reportingChainSchema } from '@/schemas/api';

// The hierarchy is visible to every signed-in role but changes with every employee edit and includes names/titles → per-request.
export const getOrgChart = (departmentId?: number) => apiFetch('/org-chart', { query: { departmentId }, schema: orgChartSchema }).then((r) => r.data);
export const getReportingChain = (id: number) => apiFetch(`/org-chart/employees/${id}/reporting-chain`, { schema: reportingChainSchema }).then((r) => r.data);
