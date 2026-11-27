import { Db, Repository, Row } from '@hr/common';

export class CustomerRepository extends Repository { constructor(db: Db) { super(db, 'customers', { softDelete: true, searchable: ['name', 'code', 'industry'], sortable: ['name', 'code', 'created_at'] }); } }
export class ContactRepository extends Repository { constructor(db: Db) { super(db, 'customer_contacts', { softDelete: true }); } }
export class ProjectRepository extends Repository {
  constructor(db: Db) { super(db, 'projects', { softDelete: true, searchable: ['name', 'code'], sortable: ['name', 'code', 'start_date', 'status', 'created_at'] }); }
  forEmployee(employeeId: string): Promise<Row[]> {
    return this.db.query('SELECT * FROM vw_project_employee_allocation WHERE employee_id = ? ORDER BY start_date DESC', [employeeId]);
  }
  accessibleIds(employeeId: string): Promise<string[]> {
    return this.db.query<Row>('SELECT DISTINCT project_id AS id FROM project_allocations WHERE employee_id = ? UNION SELECT id FROM projects WHERE project_manager_id = ? AND deleted = 0', [employeeId, employeeId]).then((r) => r.map((x) => x.id));
  }
}
export class AllocationRepository extends Repository {
  constructor(db: Db) { super(db, 'project_allocations'); }
  /** Total % already committed on [from, to] by ACTIVE allocations (locks the rows for the transaction). */
  async committed(employeeId: string, from: string, to: string | null, excludeId: string | undefined, conn: any): Promise<number> {
    const rows = await this.db.query<Row>(
      `SELECT id, allocation_percent, start_date, end_date FROM project_allocations WHERE employee_id = ? AND status = 'ACTIVE' AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) AND id <> ? FOR UPDATE`,
      [employeeId, to ?? '9999-12-31', from, excludeId ?? ''], conn);
    // peak concurrent allocation inside the window: evaluate at each start boundary
    const points = new Set<string>([from, ...rows.map((r) => (r.start_date > from ? r.start_date : from))]);
    let peak = 0;
    for (const p of points) peak = Math.max(peak, rows.filter((r) => r.start_date <= p && (!r.end_date || r.end_date >= p)).reduce((a, r) => a + Number(r.allocation_percent), 0));
    return peak;
  }
  team(projectId: string): Promise<Row[]> { return this.db.query('SELECT * FROM project_allocations WHERE project_id = ? ORDER BY status, start_date', [projectId]); }
  summary(employeeId: string, onDate: string): Promise<Row[]> { return this.db.callProcedure('sp_employee_allocation_summary', [employeeId, onDate]); }
  coveringOn(projectId: string, employeeId: string, date: string): Promise<Row | null> {
    return this.db.one("SELECT * FROM project_allocations WHERE project_id = ? AND employee_id = ? AND status = 'ACTIVE' AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) LIMIT 1", [projectId, employeeId, date, date]);
  }
}
export class ProjectHistoryRepository extends Repository {
  constructor(db: Db) { super(db, 'project_history'); }
  add(conn: any, projectId: string, type: string, oldV: unknown, newV: unknown) { return this.insert({ project_id: projectId, change_type: type, old_value: oldV == null ? null : String(oldV).slice(0, 250), new_value: newV == null ? null : String(newV).slice(0, 250) }, conn); }
}
