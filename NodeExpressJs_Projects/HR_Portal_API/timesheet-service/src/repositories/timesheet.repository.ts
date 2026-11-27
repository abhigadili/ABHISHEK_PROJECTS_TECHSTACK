import { Db, Repository, Row } from '@hr/common';

export class TimesheetRepository extends Repository {
  constructor(db: Db) { super(db, 'timesheets', { searchable: ['employee_name'], sortable: ['week_start', 'status', 'submitted_at', 'total_hours'] }); }
  byWeek(employeeId: string, weekStart: string, conn?: any, lock = false): Promise<Row | null> {
    return this.db.one(`SELECT * FROM timesheets WHERE employee_id = ? AND week_start = ? ${lock ? 'FOR UPDATE' : ''}`, [employeeId, weekStart], conn);
  }
  summary(sql: { where: string; params: unknown[] }, limit = 200): Promise<Row[]> {
    return this.db.query(`SELECT * FROM vw_timesheet_summary ${sql.where} ORDER BY week_start DESC LIMIT ?`, [...sql.params, limit]);
  }
  employeeSummary(employeeId: string, from: string, to: string): Promise<Row[]> { return this.db.callProcedure('sp_timesheet_summary', [employeeId, from, to]); }
  pendingForApprover(approverId: string, pmId: string): Promise<Row[]> {
    return this.db.query(
      `SELECT DISTINCT t.* FROM timesheets t LEFT JOIN timesheet_entries e ON e.timesheet_id = t.id
        WHERE t.status = 'SUBMITTED' AND t.employee_id <> ? AND (t.approver_id = ? OR e.project_manager_id = ?) ORDER BY t.submitted_at`, [approverId, approverId, pmId]);
  }
  projectHours(projectId: string, from: string, to: string): Promise<Row[]> {
    return this.db.query(
      `SELECT e.employee_id, t.employee_name, SUM(e.hours) AS total_hours, SUM(CASE WHEN e.billable = 1 THEN e.hours ELSE 0 END) AS billable_hours
         FROM timesheet_entries e JOIN timesheets t ON t.id = e.timesheet_id WHERE e.project_id = ? AND e.work_date BETWEEN ? AND ? AND t.status IN ('SUBMITTED','APPROVED') GROUP BY e.employee_id, t.employee_name ORDER BY total_hours DESC`, [projectId, from, to]);
  }
  employeeHours(employeeId: string, from: string, to: string): Promise<Row[]> {
    return this.db.query(
      `SELECT e.project_id, SUM(e.hours) AS total_hours, SUM(CASE WHEN e.billable = 1 THEN e.hours ELSE 0 END) AS billable_hours
         FROM timesheet_entries e JOIN timesheets t ON t.id = e.timesheet_id WHERE e.employee_id = ? AND e.work_date BETWEEN ? AND ? AND t.status IN ('SUBMITTED','APPROVED') GROUP BY e.project_id`, [employeeId, from, to]);
  }
}
export class EntryRepository extends Repository {
  constructor(db: Db) { super(db, 'timesheet_entries'); }
  forSheet(id: string, conn?: any): Promise<Row[]> { return this.db.query('SELECT * FROM timesheet_entries WHERE timesheet_id = ? ORDER BY work_date, project_id', [id], conn); }
  totals(id: string, conn?: any): Promise<Row | null> { return this.db.one('SELECT COALESCE(SUM(hours),0) AS total, COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END),0) AS billable FROM timesheet_entries WHERE timesheet_id = ?', [id], conn); }
}
export class TaskRepository extends Repository { constructor(db: Db) { super(db, 'timesheet_tasks', { softDelete: true }); } }
export class HistoryRepository extends Repository {
  constructor(db: Db) { super(db, 'timesheet_history'); }
  add(conn: any, timesheetId: string, action: string, actorId: string | null, comment?: string) { return this.insert({ timesheet_id: timesheetId, action, actor_id: actorId, comment: comment ?? null }, conn); }
}
export class EmployeeSnapshotRepository extends Repository { constructor(db: Db) { super(db, 'timesheet_employees', { pk: ['employee_id'] }); } }
