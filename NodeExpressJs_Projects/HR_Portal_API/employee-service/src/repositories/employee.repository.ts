import { Db, Repository, Row } from '@hr/common';

export class EmployeeRepository extends Repository {
  constructor(db: Db) {
    super(db, 'employees', { softDelete: true, searchable: ['first_name', 'last_name', 'employee_code', 'work_email'],
      sortable: ['first_name', 'last_name', 'employee_code', 'joining_date', 'status', 'created_at'] });
  }

  /** Atomically allocates EMP00001-style codes from the shared employee_sequence row. */
  async nextCode(conn: any): Promise<string> {
    const row = await this.db.one<Row>('SELECT next_value FROM employee_sequence WHERE id = 1 FOR UPDATE', [], conn);
    const n = row ? Number(row.next_value) : 1;
    if (row) await this.db.exec('UPDATE employee_sequence SET next_value = next_value + 1 WHERE id = 1', [], conn);
    else await this.db.exec('INSERT INTO employee_sequence (id, next_value) VALUES (1, 2)', [], conn);
    return `EMP${String(n).padStart(5, '0')}`;
  }

  directory(filters: { departmentId?: string; locationId?: string; designationId?: string; managerId?: string; status?: string; employmentType?: string; q?: string },
    page: number, size: number, sort: string, dir: 'ASC' | 'DESC') {
    const sortable: Record<string, string> = { fullName: 'full_name', employeeCode: 'employee_code', joiningDate: 'joining_date', status: 'status' };
    const where: string[] = []; const params: unknown[] = [];
    const eq = (col: string, v?: string): void => { if (v) { where.push(`${col} = ?`); params.push(v); } };
    eq('department_id', filters.departmentId); eq('location_id', filters.locationId); eq('designation_id', filters.designationId);
    eq('manager_id', filters.managerId); eq('status', filters.status); eq('employment_type', filters.employmentType);
    if (filters.q) { where.push('(full_name LIKE ? OR employee_code LIKE ? OR work_email LIKE ?)'); const l = `%${filters.q.replace(/[%_\\]/g, '\\$&')}%`; params.push(l, l, l); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const col = sortable[sort] ?? 'full_name';
    return Promise.all([
      this.db.scalar<number>(`SELECT COUNT(*) FROM vw_employee_directory ${w}`, params),
      this.db.query(`SELECT * FROM vw_employee_directory ${w} ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`, [...params, size, page * size]),
    ]);
  }

  tenureMonths(joining: string): Promise<number | null> {
    return this.db.scalar<number>('SELECT fn_employee_tenure_months(?, NULL)', [joining]);
  }
}

export class SubResourceRepository extends Repository {
  constructor(db: Db, table: string) { super(db, table); }
  forEmployee(employeeId: string) { return this.findAll({ employee_id: employeeId }, { by: 'created_at' }); }
}

export class HistoryRepository {
  constructor(private readonly db: Db) {}
  employment(employeeId: string) { return this.db.query('SELECT * FROM employment_history WHERE employee_id = ? ORDER BY effective_date DESC, created_at DESC', [employeeId]); }
  profileChanges(employeeId: string) { return this.db.query('SELECT * FROM profile_change_log WHERE employee_id = ? ORDER BY created_at DESC LIMIT 200', [employeeId]); }
  statusHistory(employeeId: string) { return this.db.query('SELECT * FROM employee_status_history WHERE employee_id = ? ORDER BY changed_at DESC', [employeeId]); }
  addEmployment(conn: any, e: { employeeId: string; type: string; from?: string | null; to?: string | null; reason?: string; effective: string }) {
    return new Repository(this.db, 'employment_history').insert({ employee_id: e.employeeId, change_type: e.type, from_value: e.from ?? null, to_value: e.to ?? null, reason: e.reason ?? null, effective_date: e.effective }, conn);
  }
  addProfileChange(conn: any, employeeId: string, field: string, oldV: unknown, newV: unknown) {
    return new Repository(this.db, 'profile_change_log').insert({ employee_id: employeeId, field_name: field, old_value: oldV == null ? null : String(oldV).slice(0, 250), new_value: newV == null ? null : String(newV).slice(0, 250) }, conn);
  }
}
