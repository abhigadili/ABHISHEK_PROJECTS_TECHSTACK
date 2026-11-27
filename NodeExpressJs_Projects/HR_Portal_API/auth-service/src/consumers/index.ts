import { Db, EventHandler, Topics } from '@hr/common';
import { AuthService } from '../services/auth.service';

/** Employee lifecycle -> account lifecycle. Runs inside the idempotency transaction. */
export function authConsumers(db: Db): Record<string, EventHandler> {
  const auth = new AuthService(db);
  return {
    [Topics.EMPLOYEE_TERMINATED]: async (ev, conn) => { if (ev.employeeId) await auth.deactivateByEmployee(ev.employeeId, conn); },
    [Topics.EMPLOYEE_EXITED]: async (ev, conn) => { if (ev.employeeId) await auth.deactivateByEmployee(ev.employeeId, conn); },
  };
}
