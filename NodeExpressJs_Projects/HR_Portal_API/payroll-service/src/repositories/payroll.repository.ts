import { Db, Repository, Row } from '@hr/common';

export class ComponentRepository extends Repository { constructor(db: Db) { super(db, 'salary_components', { softDelete: true }); } }
export class StructureRepository extends Repository {
  constructor(db: Db) { super(db, 'salary_structures', { softDelete: true }); }
  components(structureId: string): Promise<Row[]> {
    return this.db.query(
      `SELECT sc.id, sc.component_id, sc.value, c.code, c.name, c.type, c.calc_type, c.display_order, c.taxable FROM salary_structure_components sc
         JOIN salary_components c ON c.id = sc.component_id WHERE sc.structure_id = ? ORDER BY c.display_order`, [structureId]);
  }
  async replaceComponents(structureId: string, items: { componentId: string; value: number }[], conn: any): Promise<void> {
    await this.db.exec('DELETE FROM salary_structure_components WHERE structure_id = ?', [structureId], conn);
    for (const i of items) await this.db.exec('INSERT INTO salary_structure_components (id, created_at, updated_at, component_id, structure_id, value) VALUES (UUID(),?,?,?,?,?)', [new Date(), new Date(), i.componentId, structureId, i.value], conn);
  }
}
export class SalaryRepository extends Repository {
  constructor(db: Db) { super(db, 'employee_salaries'); }
  activeFor(employeeId: string, monthStart: string, monthEnd: string): Promise<Row | null> {
    return this.db.one("SELECT * FROM employee_salaries WHERE employee_id = ? AND status = 'ACTIVE' AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?) ORDER BY effective_from DESC LIMIT 1", [employeeId, monthEnd, monthStart]);
  }
  history(employeeId: string): Promise<Row[]> { return this.db.query('SELECT * FROM employee_salaries WHERE employee_id = ? ORDER BY effective_from DESC', [employeeId]); }
  revisionHistory(employeeId: string): Promise<Row[]> { return this.db.query('SELECT * FROM salary_revision_history WHERE employee_id = ? ORDER BY changed_at DESC', [employeeId]); }
  summary(employeeId: string): Promise<Row | null> { return this.db.one('SELECT * FROM vw_employee_salary_summary WHERE employee_id = ?', [employeeId]); }
}
export class RevisionRepository extends Repository { constructor(db: Db) { super(db, 'salary_revisions', { sortable: ['created_at', 'effective_from', 'status'] }); } }
export class AdjustmentRepository extends Repository {
  constructor(db: Db) { super(db, 'payroll_adjustments', { sortable: ['created_at', 'payroll_month'] }); }
  pendingFor(employeeId: string, month: string): Promise<Row[]> { return this.db.query("SELECT * FROM payroll_adjustments WHERE employee_id = ? AND payroll_month = ? AND status = 'PENDING'", [employeeId, month]); }
}
export class LoanRepository extends Repository {
  constructor(db: Db) { super(db, 'loans'); }
  activeFor(employeeId: string, month: string): Promise<Row[]> { return this.db.query("SELECT * FROM loans WHERE employee_id = ? AND status = 'ACTIVE' AND outstanding > 0 AND start_month <= ?", [employeeId, month]); }
}
export class ConfigRepository extends Repository {
  constructor(db: Db) { super(db, 'payroll_config'); }
  /** Latest effective value per key. */
  async latest(): Promise<Map<string, string>> {
    const rows = await this.db.query<Row>('SELECT config_key, config_value FROM payroll_config c WHERE effective_from = (SELECT MAX(effective_from) FROM payroll_config WHERE config_key = c.config_key AND effective_from <= UTC_TIMESTAMP())');
    return new Map(rows.map((r) => [r.config_key as string, r.config_value as string]));
  }
}
export class RunRepository extends Repository { constructor(db: Db) { super(db, 'payroll_runs', { sortable: ['payroll_month', 'created_at', 'status'] }); } }
export class EntryRepository extends Repository {
  constructor(db: Db) { super(db, 'payroll_entries', { sortable: ['employee_name', 'net', 'gross'], searchable: ['employee_name', 'employee_code'] }); }
  lines(entryId: string): Promise<Row[]> { return this.db.query('SELECT * FROM payroll_entry_lines WHERE entry_id = ? ORDER BY type DESC, created_at', [entryId]); }
  linesForRun(runId: string): Promise<Row[]> { return this.db.query('SELECT l.* FROM payroll_entry_lines l JOIN payroll_entries e ON e.id = l.entry_id WHERE e.run_id = ?', [runId]); }
  byDepartment(runId: string): Promise<Row[]> { return this.db.query('SELECT department_id, COUNT(*) AS employees, SUM(gross) AS gross, SUM(deductions) AS deductions, SUM(net) AS net FROM payroll_entries WHERE run_id = ? GROUP BY department_id', [runId]); }
  async clearRun(runId: string, conn: any): Promise<void> {
    await this.db.exec('DELETE FROM loan_deductions WHERE run_id = ?', [runId], conn);
    await this.db.exec('DELETE l FROM payroll_entry_lines l JOIN payroll_entries e ON e.id = l.entry_id WHERE e.run_id = ?', [runId], conn);
    await this.db.exec('DELETE FROM payroll_entries WHERE run_id = ?', [runId], conn);
  }
  overtimePay(minutes: number, hourly: number, mult: number): Promise<number> { return this.db.scalar<number>('SELECT fn_overtime_pay(?,?,?)', [minutes, hourly, mult]).then((v) => Number(v ?? 0)); }
}
export class PayslipRepository extends Repository {
  constructor(db: Db) { super(db, 'payslips', { sortable: ['payroll_month', 'generated_at'] }); }
}
