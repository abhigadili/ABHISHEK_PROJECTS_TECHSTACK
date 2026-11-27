import { ServiceClient } from '@hr/common';

export interface HolidayItem { id: string; name: string; holidayDate: string; type: string; locationIds: string[]; departmentIds: string[] }

/** Attendance Service -> Holiday Service (synchronous) to refresh the local holiday_snapshots. */
export class HolidayClient {
  private readonly http = new ServiceClient('holiday');
  forYear(year: number) { return this.http.get<HolidayItem[]>('/api/v1/holidays', { year }); }
}
