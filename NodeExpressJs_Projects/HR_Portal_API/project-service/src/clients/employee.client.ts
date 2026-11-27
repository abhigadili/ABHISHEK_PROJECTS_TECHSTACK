import { ServiceClient } from '@hr/common';

/** Project Service -> Employee Service: validates people referenced by allocations / project managers. */
export class EmployeeClient {
  private readonly http = new ServiceClient('employee');
  summary(id: string) { return this.http.get<{ employeeId: string; fullName: string; status: string; joiningDate: string | null; exitDate: string | null }>(`/api/v1/employees/${id}/summary`); }
}
