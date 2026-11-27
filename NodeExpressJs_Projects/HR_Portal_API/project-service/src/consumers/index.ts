import { Db, EventHandler, Topics, today } from '@hr/common';

/** When an employee exits, their open project allocations are ended automatically. */
export function projectConsumers(db: Db): Record<string, EventHandler> {
  const end: EventHandler = async (ev, conn) => {
    if (!ev.employeeId) return;
    const day = (ev.payload as any)?.exitDate ?? today();
    await db.exec("UPDATE project_allocations SET status = 'ENDED', end_date = LEAST(COALESCE(end_date, ?), ?), updated_at = ?, updated_by = 'system' WHERE employee_id = ? AND status = 'ACTIVE'", [day, day, new Date(), ev.employeeId], conn);
  };
  return { [Topics.EMPLOYEE_EXITED]: end, [Topics.EMPLOYEE_TERMINATED]: end };
}
