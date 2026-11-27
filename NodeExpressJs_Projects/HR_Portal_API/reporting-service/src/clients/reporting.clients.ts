import { ServiceClient } from '@hr/common';

/** Reporting Service reads other domains through their REST APIs (never through their databases). */
export class DomainClients {
  private readonly payroll = new ServiceClient('payroll', { timeoutMs: 10000 });
  private readonly project = new ServiceClient('project', { timeoutMs: 10000 });
  private readonly timesheet = new ServiceClient('timesheet', { timeoutMs: 10000 });
  private readonly performance = new ServiceClient('performance', { timeoutMs: 10000 });
  payrollRuns(month?: string) { return this.payroll.get<{ content: any[] }>('/api/v1/payroll/runs', { size: 24, sort: 'payroll_month,desc' }).then((p) => (month ? p.content.filter((r) => r.payrollMonth === month) : p.content)); }
  payrollRunReport(id: string) { return this.payroll.get<any>(`/api/v1/payroll/runs/${id}/report`); }
  projects(status?: string) { return this.project.get<{ content: any[] }>('/api/v1/projects', { size: 100, status }); }
  project_(id: string) { return this.project.get<any>(`/api/v1/projects/${id}`); }
  projectHours(projectId: string, from: string, to: string) { return this.timesheet.get<any>(`/api/v1/timesheets/reports/project-hours/${projectId}`, { from, to }); }
  cycleReport(id: string) { return this.performance.get<any>(`/api/v1/performance/cycles/${id}/report`); }
}
