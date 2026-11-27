import { ServiceClient } from '@hr/common';

/** Organization Service -> Employee Service: manager assignment is applied on the employee record. */
export class EmployeeClient {
  private readonly http = new ServiceClient('employee');
  async assignManager(employeeId: string, managerId: string | null): Promise<void> {
    const profile = await this.http.get<{ version: number }>(`/api/v1/employees/${employeeId}`);
    await this.http.patch(`/api/v1/employees/${employeeId}`, { managerId: managerId ?? undefined, version: profile.version });
  }
}
