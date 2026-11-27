import { Db, EventHandler, Topics, employeeSnapshotConsumers } from '@hr/common';
import { CalendarRepository } from '../repositories/attendance.repository';

/** employee snapshot + approved-leave days feed the monthly attendance stored procedure. */
export function attendanceConsumers(db: Db): Record<string, EventHandler> {
  const cal = new CalendarRepository(db);
  const base = employeeSnapshotConsumers(db, 'attendance_employees', (s) => ({
    employee_id: s.employeeId, department_id: s.departmentId, full_name: s.fullName, joining_date: s.joiningDate, location_id: s.locationId, manager_id: s.managerId, status: s.status,
  }));
  return {
    ...base,
    [Topics.LEAVE_APPROVED]: async (ev, conn) => { await cal.addLeaveDays(ev.payload.applicationId, ev.payload.employeeId, ev.payload.dates, conn); },
    [Topics.LEAVE_CANCELLED]: async (ev, conn) => { await cal.removeLeaveDays(ev.payload.applicationId, conn); },
  };
}
