import { Db, EventHandler, employeeSnapshotConsumers, Topics, logger } from '@hr/common';
import { BalanceService } from '../services/balance.service';

/** Maintains leave_employees and creates leave balances for newly onboarded employees. */
export function leaveConsumers(db: Db): Record<string, EventHandler> {
  const balances = new BalanceService(db);
  const handlers = employeeSnapshotConsumers(db, 'leave_employees', (s) => ({
    employee_id: s.employeeId, department_id: s.departmentId, full_name: s.fullName, gender: s.gender, joining_date: s.joiningDate, location_id: s.locationId, manager_id: s.managerId, status: s.status,
  }), async (ev, conn) => {
    if (ev.eventType === Topics.EMPLOYEE_CREATED) {
      const n = await balances.initialise(ev.payload.employeeId, ev.payload.joiningDate, new Date().getFullYear(), conn);
      logger.info({ employeeId: ev.payload.employeeId, created: n }, 'leave balances initialised');
    }
    await balances.evict(ev.payload.employeeId);
  });
  return handlers;
}
