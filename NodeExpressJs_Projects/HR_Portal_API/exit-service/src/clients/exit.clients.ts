import { ServiceClient } from '@hr/common';

/** Exit Service -> Employee Service */
export class EmployeeClient {
  private readonly http = new ServiceClient('employee');
  summary(id: string) { return this.http.get<{ employeeId: string; employeeCode: string; fullName: string; status: string; managerId: string | null; departmentId: string | null; joiningDate: string | null; noticePeriodDays: number }>(`/api/v1/employees/${id}/summary`); }
}
/** Exit Service -> Payroll Service: salary basis for the settlement and posting the final settlement into payroll. */
export class PayrollClient {
  private readonly http = new ServiceClient('payroll');
  basis(employeeId: string) { return this.http.get<{ monthlyGross: number; currency: string } | null>(`/api/v1/payroll/settlement-basis/${employeeId}`); }
  postSettlement(body: { employeeId: string; amount: number; month: string; referenceId: string; description: string }) { return this.http.post('/api/v1/payroll/settlements', body); }
}
