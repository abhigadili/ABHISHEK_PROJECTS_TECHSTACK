import { Db, Repository, Row } from '@hr/common';

export class ReferenceRepository extends Repository {
  constructor(db: Db, table: string, search: string[]) { super(db, table, { softDelete: true, searchable: search }); }
}

export class OrgGraphRepository {
  constructor(private readonly db: Db) {}
  nodes(): Promise<Row[]> {
    return this.db.query("SELECT employee_id, employee_code, full_name, department_id, designation_id, manager_id, status, email FROM org_employee_nodes WHERE status IN ('ACTIVE','ON_NOTICE')");
  }
  node(employeeId: string): Promise<Row | null> { return this.db.one('SELECT * FROM org_employee_nodes WHERE employee_id = ?', [employeeId]); }
  departmentEmployees(departmentId: string, page: number, size: number) {
    return Promise.all([
      this.db.scalar<number>('SELECT COUNT(*) FROM org_employee_nodes WHERE department_id = ?', [departmentId]),
      this.db.query('SELECT employee_id, employee_code, full_name, designation_id, manager_id, status, email, joining_date FROM org_employee_nodes WHERE department_id = ? ORDER BY full_name LIMIT ? OFFSET ?', [departmentId, size, page * size]),
    ]);
  }
  reportingChain(employeeId: string): Promise<Row[]> {
    return this.db.query(
      `WITH RECURSIVE chain AS (
         SELECT employee_id, full_name, employee_code, manager_id, designation_id, 0 AS level FROM org_employee_nodes WHERE employee_id = ?
         UNION ALL
         SELECT n.employee_id, n.full_name, n.employee_code, n.manager_id, n.designation_id, c.level + 1
           FROM org_employee_nodes n JOIN chain c ON n.employee_id = c.manager_id WHERE c.level < 30)
       SELECT * FROM chain ORDER BY level`, [employeeId]);
  }
  subordinates(employeeId: string): Promise<Row[]> {
    return this.db.query(
      `WITH RECURSIVE sub AS (
         SELECT employee_id, full_name, manager_id, 1 AS level FROM org_employee_nodes WHERE manager_id = ?
         UNION ALL
         SELECT n.employee_id, n.full_name, n.manager_id, s.level + 1 FROM org_employee_nodes n JOIN sub s ON n.manager_id = s.employee_id WHERE s.level < 30)
       SELECT * FROM sub ORDER BY level, full_name`, [employeeId]);
  }
  currentLine(employeeId: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM reporting_lines WHERE employee_id = ? AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1', [employeeId]);
  }
  lines(employeeId: string): Promise<Row[]> {
    return this.db.query('SELECT * FROM reporting_lines WHERE employee_id = ? ORDER BY effective_from DESC', [employeeId]);
  }
  departments(): Promise<Row[]> {
    return this.db.query('SELECT id, code, name, parent_id, head_employee_id, business_unit_id FROM departments WHERE deleted = 0 AND active = 1 ORDER BY name');
  }
  departmentHeadcounts(): Promise<Row[]> {
    return this.db.query("SELECT department_id, COUNT(*) AS headcount FROM org_employee_nodes WHERE status IN ('ACTIVE','ON_NOTICE') GROUP BY department_id");
  }
  details(employeeId: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM vw_employee_department_details WHERE employee_id = ?', [employeeId]);
  }
}
