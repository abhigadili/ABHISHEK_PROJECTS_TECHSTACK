import { Db, EventHandler, employeeSnapshotConsumers } from '@hr/common';
import { OrgStructureService } from '../services/organization.service';

/** Maintains org_employee_nodes (employee read model) and the reporting_lines history. */
export function orgConsumers(db: Db): Record<string, EventHandler> {
  const structure = new OrgStructureService(db);
  return employeeSnapshotConsumers(db, 'org_employee_nodes', (s) => ({
    employee_id: s.employeeId, department_id: s.departmentId, designation_id: s.designationId, email: s.workEmail, employee_code: s.employeeCode,
    full_name: s.fullName, joining_date: s.joiningDate, location_id: s.locationId, manager_id: s.managerId, status: s.status,
  }), async (ev, conn) => {
    await structure.recordManagerChange(ev.payload.employeeId, ev.payload.managerId, (ev.timestamp ?? new Date().toISOString()).slice(0, 10), conn);
    await structure.cacheEvict();
  });
}
