import { Db, EventHandler, employeeSnapshotConsumers } from '@hr/common';
export const perfConsumers = (db: Db): Record<string, EventHandler> =>
  employeeSnapshotConsumers(db, 'perf_employees', (s) => ({ employee_id: s.employeeId, department_id: s.departmentId, full_name: s.fullName, manager_id: s.managerId, status: s.status }));
