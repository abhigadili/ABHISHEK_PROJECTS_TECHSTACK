import { Db, Repository, Row, upsertRow } from '@hr/common';

export class EmployeeReadModel extends Repository {
  constructor(db: Db) { super(db, 'rpt_employees', { pk: ['employee_id'] }); }
  headcountByDepartment(): Promise<Row[]> { return this.db.query('SELECT department_id, status, employees FROM vw_headcount_by_department ORDER BY department_id, status'); }
  movements(from: string, to: string, departmentId?: string): Promise<{ joiners: Row[]; leavers: Row[] }> {
    const dep = departmentId ? 'AND department_id = ?' : ''; const p = departmentId ? [departmentId] : [];
    return Promise.all([
      this.db.query(`SELECT DATE_FORMAT(joining_date,'%Y-%m') AS month, COUNT(*) AS employees FROM rpt_employees WHERE joining_date BETWEEN ? AND ? ${dep} GROUP BY month ORDER BY month`, [from, to, ...p]),
      this.db.query(`SELECT DATE_FORMAT(exit_date,'%Y-%m') AS month, COUNT(*) AS employees FROM rpt_employees WHERE exit_date BETWEEN ? AND ? ${dep} GROUP BY month ORDER BY month`, [from, to, ...p]),
    ]).then(([joiners, leavers]) => ({ joiners, leavers }));
  }
  teamIds(managerId: string): Promise<string[]> { return this.db.query<Row>('SELECT employee_id FROM rpt_employees WHERE manager_id = ?', [managerId]).then((r) => r.map((x) => x.employee_id)); }
  byDepartment(): Promise<Map<string, string | null>> { return this.db.query<Row>('SELECT employee_id, department_id FROM rpt_employees').then((r) => new Map(r.map((x) => [x.employee_id, x.department_id]))); }
  async *stream(): AsyncGenerator<Row> {
    for (let offset = 0; ; offset += 500) {
      const rows = await this.db.query('SELECT employee_id, employee_code, full_name, department_id, designation_id, location_id, manager_id, status, joining_date, exit_date FROM rpt_employees ORDER BY employee_id LIMIT 500 OFFSET ?', [offset]);
      if (!rows.length) return;
      yield* rows;
    }
  }
}

export class FactRepository extends Repository {
  constructor(db: Db) { super(db, 'rpt_facts', { sortable: ['occurred_at'] }); }
  /** Idempotent fact upsert keyed by (fact_type, subject_key). */
  async record(f: { type: string; subjectKey: string; category?: string | null; status?: string | null; period?: string | null; dateA?: string | null; dateB?: string | null; departmentId?: string | null; employeeId?: string | null; a?: number | null; b?: number | null; c?: number | null; occurredAt: Date }, conn: any): Promise<void> {
    const existing = await this.db.one<Row>('SELECT id FROM rpt_facts WHERE fact_type = ? AND subject_key = ?', [f.type, f.subjectKey], conn);
    const row = { fact_type: f.type, subject_key: f.subjectKey, category: f.category ?? null, status: f.status ?? null, period_key: f.period ?? null, date_a: f.dateA ?? null, date_b: f.dateB ?? null, department_id: f.departmentId ?? null, employee_id: f.employeeId ?? null, num_a: f.a ?? null, num_b: f.b ?? null, num_c: f.c ?? null, occurred_at: f.occurredAt };
    if (existing) await this.update(existing.id, row, conn); else await this.insert(row, conn);
  }
  leaveByType(from: string, to: string): Promise<Row[]> {
    return this.db.query("SELECT category AS leave_type, status, COUNT(*) AS applications, SUM(num_a) AS days FROM rpt_facts WHERE fact_type = 'LEAVE' AND date_a BETWEEN ? AND ? GROUP BY category, status ORDER BY category, status", [from, to]);
  }
  leaveRows(from: string, to: string): Promise<Row[]> { return this.db.query("SELECT employee_id, category, status, num_a, period_key FROM rpt_facts WHERE fact_type = 'LEAVE' AND date_a BETWEEN ? AND ?", [from, to]); }
  utilization(): Promise<Row[]> { return this.db.query('SELECT * FROM vw_leave_utilization ORDER BY month DESC, leave_type'); }
  attendanceDaily(month: string): Promise<Row[]> {
    return this.db.query("SELECT date_a AS date, SUM(status = 'CHECKED_IN') AS check_ins, SUM(status = 'CHECKED_OUT') AS check_outs, SUM(status = 'CORRECTED') AS corrections, AVG(NULLIF(num_a,0)) AS avg_worked_minutes FROM rpt_facts WHERE fact_type = 'ATTENDANCE' AND period_key = ? GROUP BY date_a ORDER BY date_a", [month]);
  }
  taxByStatus(fy: string): Promise<Row[]> { return this.db.query("SELECT category AS regime, status, COUNT(*) AS declarations, SUM(num_a) AS total_declared FROM rpt_facts WHERE fact_type = 'TAX' AND period_key = ? GROUP BY category, status", [fy]); }
  timesheetByStatus(from: string, to: string): Promise<Row[]> { return this.db.query("SELECT status, COUNT(*) AS timesheets, SUM(num_a) AS hours FROM rpt_facts WHERE fact_type = 'TIMESHEET' AND date_a BETWEEN ? AND ? GROUP BY status", [from, to]); }
  exits(from: string, to: string): Promise<Row[]> { return this.db.query("SELECT subject_key, category AS reason, status, period_key, date_a AS last_working_day FROM rpt_facts WHERE fact_type = 'EXIT' AND (date_a BETWEEN ? AND ? OR date_a IS NULL) ORDER BY occurred_at DESC", [from, to]); }
  performance(): Promise<Row[]> { return this.db.query("SELECT status, category, COUNT(*) AS reviews, AVG(num_a) AS avg_rating FROM rpt_facts WHERE fact_type = 'REVIEW' GROUP BY status, category"); }
}
export { upsertRow };
