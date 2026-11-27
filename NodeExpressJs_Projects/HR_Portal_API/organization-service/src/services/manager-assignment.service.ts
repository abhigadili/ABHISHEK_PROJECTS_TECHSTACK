import { Db, today } from '@hr/common';
import { EmployeeClient } from '../clients/employee.client';
import { OrgStructureService } from './organization.service';

export class ManagerAssignmentService {
  private readonly employees = new EmployeeClient();
  private readonly structure: OrgStructureService;
  constructor(db: Db) { this.structure = new OrgStructureService(db); }

  async assign(employeeId: string, managerId: string | null, effectiveFrom = today()) {
    if (managerId) await this.structure.assertNoCycle(employeeId, managerId);
    await this.employees.assignManager(employeeId, managerId); // authoritative change in employee-service
    await this.structure.recordManagerChange(employeeId, managerId, effectiveFrom);
    await this.structure.cacheEvict();
    await this.structure.audit('ReportingLine', employeeId, 'MANAGER_ASSIGNED', undefined, { managerId, effectiveFrom });
    return { employeeId, managerId, effectiveFrom };
  }
}
