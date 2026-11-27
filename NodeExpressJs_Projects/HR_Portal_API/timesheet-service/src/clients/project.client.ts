import { ServiceClient } from '@hr/common';

export interface AllocationCheck { projectId: string; projectCode: string; projectStatus: string; projectManagerId: string; allocated: boolean; allocationPercent: number; billable: boolean }

/** Timesheet Service -> Project Service: validates employee allocation before accepting entries. */
export class ProjectClient {
  private readonly http = new ServiceClient('project');
  check(projectId: string, employeeId: string, date: string) { return this.http.get<AllocationCheck>(`/api/v1/projects/${projectId}/allocation-check`, { employeeId, date }); }
}
