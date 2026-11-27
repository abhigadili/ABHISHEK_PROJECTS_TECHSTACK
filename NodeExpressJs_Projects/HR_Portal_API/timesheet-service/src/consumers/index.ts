import { Db, EventHandler, employeeSnapshotConsumers } from '@hr/common';
export const timesheetConsumers = (db: Db): Record<string, EventHandler> =>
  employeeSnapshotConsumers(db, 'timesheet_employees', (s) => ({ employee_id: s.employeeId, full_name: s.fullName, manager_id: s.managerId, status: s.status }));
