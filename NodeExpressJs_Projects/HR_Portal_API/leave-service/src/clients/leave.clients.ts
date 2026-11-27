import { ServiceClient, cache, key, isWeekend } from '@hr/common';

/** Leave Service -> Holiday Service: mandatory holidays that fall on weekdays reduce the leave duration. */
export class HolidayClient {
  private readonly http = new ServiceClient('holiday');
  async weekdayHolidays(from: string, to: string, locationId?: string | null, departmentId?: string | null): Promise<string[]> {
    const k = key('leave', 'holidays', from, to, locationId ?? '-', departmentId ?? '-');
    return cache.getOrLoad(k, 300, async () => {
      const r = await this.http.get<{ dates: string[] }>('/api/v1/holidays/count', { from, to, locationId: locationId ?? undefined, departmentId: departmentId ?? undefined });
      return r.dates.filter((d) => !isWeekend(d));
    });
  }
}

/** Leave Service -> Employee Service: fallback when the local employee read model has no row yet. */
export class EmployeeClient {
  private readonly http = new ServiceClient('employee');
  summary(id: string) { return this.http.get<{ employeeId: string; fullName: string; managerId: string | null; departmentId: string | null; locationId: string | null; status: string; gender: string | null; joiningDate: string | null }>(`/api/v1/employees/${id}/summary`); }
}
