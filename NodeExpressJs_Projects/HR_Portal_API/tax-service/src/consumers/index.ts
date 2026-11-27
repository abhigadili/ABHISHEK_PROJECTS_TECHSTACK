import { Db, EventHandler, employeeSnapshotConsumers } from '@hr/common';
export const taxConsumers = (db: Db): Record<string, EventHandler> =>
  employeeSnapshotConsumers(db, 'tax_employees', (s) => ({ employee_id: s.employeeId, full_name: s.fullName, status: s.status }));
