import { ServiceClient } from '@hr/common';

/** Tax Service -> Payroll Service: annual CTC used as the gross income base for TDS projection. */
export class PayrollClient {
  private readonly http = new ServiceClient('payroll');
  async annualGross(employeeId: string): Promise<number | null> {
    try {
      const r = await this.http.get<{ summary: { annualCtc?: number } | null }>(`/api/v1/payroll/salaries/employee/${employeeId}`);
      return r.summary?.annualCtc ? Number(r.summary.annualCtc) : null;
    } catch (e: any) { if (e.status === 403 || e.status === 404) return null; throw e; }
  }
}
