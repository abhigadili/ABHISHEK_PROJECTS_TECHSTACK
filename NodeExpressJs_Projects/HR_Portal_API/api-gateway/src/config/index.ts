import { env, envInt, serviceUrl } from '@hr/common';

export const gatewayConfig = { port: envInt('GATEWAY_PORT', 31080), rateLimitPerMinute: envInt('RATE_LIMIT_PER_MINUTE', 300), proxyTimeoutMs: envInt('GATEWAY_PROXY_TIMEOUT_MS', 30000), dashboardTimeoutMs: envInt('DASHBOARD_TIMEOUT_MS', 6000) };
void env;

export interface RouteRule {
  /** path prefix after /api/v1 */
  prefix: string;
  service: string;
  /** coarse gateway-level authorization: the caller must hold at least one of these permissions (services still enforce fine-grained rules) */
  anyPermission?: string[];
  /** anonymous endpoints (login etc.) */
  publicPaths?: RegExp[];
}

/** Centralised routing + authorization table. */
export const ROUTES: RouteRule[] = [
  { prefix: 'auth', service: 'auth', publicPaths: [/^\/api\/v1\/auth\/(login|refresh)$/, /^\/api\/v1\/auth\/password\/(forgot|reset)$/] },
  { prefix: 'employees', service: 'employee' },
  { prefix: 'organization', service: 'organization' },
  { prefix: 'leaves', service: 'leave' }, { prefix: 'leave-balances', service: 'leave' }, { prefix: 'leave-types', service: 'leave' }, { prefix: 'leave-policies', service: 'leave', anyPermission: ['LEAVE_POLICY_MANAGE'] },
  { prefix: 'attendance', service: 'attendance' },
  { prefix: 'holidays', service: 'holiday' },
  { prefix: 'payroll', service: 'payroll' },
  { prefix: 'tax', service: 'tax' },
  { prefix: 'performance', service: 'performance' },
  { prefix: 'customers', service: 'project', anyPermission: ['PROJECT_MANAGE', 'REPORT_VIEW', 'PAYROLL_VIEW'] }, { prefix: 'projects', service: 'project' },
  { prefix: 'timesheets', service: 'timesheet' },
  { prefix: 'exit', service: 'exit' },
  { prefix: 'documents', service: 'document' },
  { prefix: 'notifications', service: 'notification' },
  { prefix: 'reports', service: 'reporting', anyPermission: ['REPORT_VIEW'] },
];
export const targetFor = (service: string): string => serviceUrl(service);
