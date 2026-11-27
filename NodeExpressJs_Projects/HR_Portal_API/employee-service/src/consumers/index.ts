import { Db, EventHandler, Topics } from '@hr/common';
import { EmployeeService } from '../services/employee.service';

/** Exit workflow -> employee status (step 8 of the exit workflow). */
export function employeeConsumers(db: Db): Record<string, EventHandler> {
  const svc = new EmployeeService(db);
  return {
    [Topics.EMPLOYEE_EXITED]: async (ev, conn) => {
      if (ev.source === 'employee-service') return; // our own status change
      if (ev.employeeId) await svc.applyExit(ev.employeeId, (ev.payload as any)?.exitDate ?? (ev.payload as any)?.lastWorkingDay ?? null, conn);
    },
    [Topics.RESIGNATION_SUBMITTED]: async (ev, conn) => { if (ev.employeeId) await svc.applyNotice(ev.employeeId, conn); },
    [Topics.RESIGNATION_WITHDRAWN]: async (ev, conn) => { if (ev.employeeId) await svc.revertNotice(ev.employeeId, conn); },
  };
}
