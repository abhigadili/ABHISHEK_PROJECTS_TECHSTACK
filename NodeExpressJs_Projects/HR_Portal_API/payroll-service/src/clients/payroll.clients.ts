import { ServiceClient } from '@hr/common';

export interface DirectoryEntry { employeeId: string; employeeCode: string; fullName: string; departmentId: string; status: string; joiningDate: string }

/** Payroll Service -> Employee Service */
export class EmployeeClient {
  private readonly http = new ServiceClient('employee', { timeoutMs: 8000 });
  async activeEmployees(): Promise<DirectoryEntry[]> {
    const out: DirectoryEntry[] = [];
    for (let page = 0; ; page++) {
      const r = await this.http.get<{ content: DirectoryEntry[]; totalPages: number }>('/api/v1/employees', { page, size: 200, status: 'ACTIVE' });
      out.push(...r.content);
      if (page + 1 >= r.totalPages) break;
    }
    const notice = await this.http.get<{ content: DirectoryEntry[] }>('/api/v1/employees', { page: 0, size: 200, status: 'ON_NOTICE' });
    return [...out, ...notice.content];
  }
  summary(id: string) { return this.http.get<{ employeeId: string; employeeCode: string; fullName: string; departmentId: string; status: string }>(`/api/v1/employees/${id}/summary`); }
}

export interface AttendancePayrollInput { workingDays: number; presentDays: number; halfDays: number; absentDays: number; leaveDays: number; overtimeMinutes: number }
/** Payroll Service -> Attendance Service */
export class AttendanceClient {
  private readonly http = new ServiceClient('attendance', { timeoutMs: 15000 });
  payrollInput(employeeId: string, month: string) { return this.http.get<AttendancePayrollInput>('/api/v1/attendance/payroll-input', { employeeId, month }); }
}

/** Payroll Service -> Leave Service */
export class LeaveClient {
  private readonly http = new ServiceClient('leave');
  monthly(employeeId: string, month: string) { return this.http.get<{ paidLeaveDays: number; unpaidLeaveDays: number }>(`/api/v1/leaves/summary/${employeeId}/${month}`); }
}

/** Payroll Service -> Tax Service (monthly TDS). */
export class TaxClient {
  private readonly http = new ServiceClient('tax');
  async monthlyTds(employeeId: string, month: string): Promise<number> {
    try { const r = await this.http.get<{ tds: number }>(`/api/v1/tax/tds/${employeeId}/${month}`); return Number(r.tds ?? 0); } catch (e: any) { if (e.status === 404) return 0; throw e; }
  }
}
