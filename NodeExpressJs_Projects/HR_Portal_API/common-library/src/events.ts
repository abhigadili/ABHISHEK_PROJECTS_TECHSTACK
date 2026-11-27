import type { Db } from './db';
import { upsertRow } from './db';
import type { EventEnvelope, EventHandler } from './kafka';
import { Topics } from './kafka';
import type { Row } from './types';

/** Payload shared by employee.created / updated / terminated / exited events. */
export interface EmployeeSnapshot {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  workEmail: string | null;
  departmentId: string | null;
  designationId: string | null;
  locationId: string | null;
  managerId: string | null;
  status: string;
  joiningDate: string | null;
  exitDate: string | null;
  gender: string | null;
}

export function employeeSnapshot(e: Row): EmployeeSnapshot {
  return {
    employeeId: e.id, employeeCode: e.employee_code ?? null,
    fullName: [e.first_name, e.last_name].filter(Boolean).join(' '), workEmail: e.work_email ?? null,
    departmentId: e.department_id ?? null, designationId: e.designation_id ?? null, locationId: e.location_id ?? null,
    managerId: e.manager_id ?? null, status: e.status, joiningDate: e.joining_date ?? null, exitDate: e.exit_date ?? null, gender: e.gender ?? null,
  };
}

/**
 * Builds the consumer handlers that keep a service-local employee read model (e.g. leave_employees)
 * in sync with employee lifecycle events. Every service owns its own copy => no cross-database reads.
 */
export function employeeSnapshotConsumers(db: Db, table: string, map: (s: EmployeeSnapshot) => Row, extra?: EventHandler): Record<string, EventHandler> {
  const handler: EventHandler = async (ev: EventEnvelope<EmployeeSnapshot>, conn, meta) => {
    const s = ev.payload;
    if (!s?.employeeId) return;
    // events from other publishers (e.g. exit-service's employee.exited) carry no full snapshot: only run the extra hook
    if (s.fullName === undefined) { await extra?.(ev, conn, meta); return; }
    await upsertRow(db, table, { ...map(s), updated_at: new Date() }, conn);
    await extra?.(ev, conn, meta);
  };
  return {
    [Topics.EMPLOYEE_CREATED]: handler, [Topics.EMPLOYEE_UPDATED]: handler,
    [Topics.EMPLOYEE_TERMINATED]: handler, [Topics.EMPLOYEE_EXITED]: handler,
  };
}
