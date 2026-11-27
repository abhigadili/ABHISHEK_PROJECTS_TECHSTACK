import { Db, Repository, Row } from '@hr/common';

export class LeaveTypeRepository extends Repository { constructor(db: Db) { super(db, 'leave_types', { softDelete: true, searchable: ['name', 'code'] }); } }
export class PolicyRepository extends Repository {
  constructor(db: Db) { super(db, 'leave_policies', { softDelete: true }); }
  entitlements(policyId: string): Promise<Row[]> {
    return this.db.query('SELECT e.*, t.code AS leave_type_code, t.name AS leave_type_name FROM leave_policy_entitlements e JOIN leave_types t ON t.id = e.leave_type_id WHERE e.policy_id = ? ORDER BY t.code', [policyId]);
  }
  async replaceEntitlements(policyId: string, items: Row[], conn: any): Promise<void> {
    await this.db.exec('DELETE FROM leave_policy_entitlements WHERE policy_id = ?', [policyId], conn);
    for (const e of items) {
      await this.db.exec('INSERT INTO leave_policy_entitlements (leave_type_id, policy_id, accrual_per_month, annual_days, carry_forward_max, encashable, encashment_max_days, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [e.leaveTypeId, policyId, e.accrualPerMonth, e.annualDays, e.carryForwardMax, e.encashable ? 1 : 0, e.encashmentMaxDays, new Date(), new Date()], conn);
    }
  }
  defaultPolicy(): Promise<Row | null> { return this.db.one('SELECT * FROM leave_policies WHERE deleted = 0 AND active = 1 ORDER BY is_default DESC, created_at LIMIT 1'); }
}

export class EmployeeSnapshotRepository extends Repository {
  constructor(db: Db) { super(db, 'leave_employees', { pk: ['employee_id'] }); }
  activeEmployees(): Promise<Row[]> { return this.db.query("SELECT * FROM leave_employees WHERE status IN ('ACTIVE','ON_NOTICE')"); }
}

export class BalanceRepository {
  constructor(private readonly db: Db) {}
  get(employeeId: string, leaveTypeId: string, year: number, conn?: any, lock = false): Promise<Row | null> {
    return this.db.one(`SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ? ${lock ? 'FOR UPDATE' : ''}`, [employeeId, leaveTypeId, year], conn);
  }
  forEmployee(employeeId: string, year: number): Promise<Row[]> {
    return this.db.query(
      `SELECT b.*, t.code AS leave_type_code, t.name AS leave_type_name, t.paid, t.balance_tracked,
              (b.opening + b.accrued + b.carried_forward + b.adjusted) AS entitled,
              (b.opening + b.accrued + b.carried_forward + b.adjusted - b.used - b.pending - b.encashed) AS available
         FROM leave_balances b JOIN leave_types t ON t.id = b.leave_type_id WHERE b.employee_id = ? AND b.balance_year = ? ORDER BY t.code`, [employeeId, year]);
  }
  history(employeeId: string, year?: number): Promise<Row[]> {
    return this.db.query(`SELECT h.*, t.code AS leave_type_code FROM leave_balance_history h JOIN leave_types t ON t.id = h.leave_type_id WHERE h.employee_id = ? ${year ? 'AND h.balance_year = ?' : ''} ORDER BY h.changed_at DESC LIMIT 300`, year ? [employeeId, year] : [employeeId]);
  }
  /** Relative update (pending/used/encashed/adjusted/accrued deltas); the DB trigger records leave_balance_history. */
  async adjust(employeeId: string, leaveTypeId: string, year: number, d: { pending?: number; used?: number; encashed?: number; adjusted?: number }, by: string, conn: any): Promise<void> {
    await this.db.exec(
      `UPDATE leave_balances SET pending = pending + ?, used = used + ?, encashed = encashed + ?, adjusted = adjusted + ?, version = version + 1, updated_at = ?, updated_by = ?
        WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ?`,
      [d.pending ?? 0, d.used ?? 0, d.encashed ?? 0, d.adjusted ?? 0, new Date(), by, employeeId, leaveTypeId, year], conn);
  }
  async setAccrued(employeeId: string, leaveTypeId: string, year: number, accrued: number, by: string, conn?: any): Promise<void> {
    await this.db.exec('UPDATE leave_balances SET accrued = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ? AND accrued <> ?',
      [accrued, new Date(), by, employeeId, leaveTypeId, year, accrued], conn);
  }
  async create(employeeId: string, leaveTypeId: string, year: number, v: { opening: number; accrued: number; carried: number }, by: string, conn?: any): Promise<void> {
    await this.db.exec(
      `INSERT IGNORE INTO leave_balances (employee_id, leave_type_id, balance_year, accrued, adjusted, carried_forward, created_at, encashed, opening, pending, updated_at, updated_by, used, version)
       VALUES (?,?,?,?,0,?,?,0,?,0,?,?,0,0)`, [employeeId, leaveTypeId, year, v.accrued, v.carried, new Date(), v.opening, new Date(), by], conn);
  }
  storedProcedure(employeeId: string, year: number): Promise<Row[]> { return this.db.callProcedure('sp_calculate_leave_balance', [employeeId, year]); }
}

export class ApplicationRepository extends Repository {
  constructor(db: Db) { super(db, 'leave_applications', { searchable: ['employee_name', 'reason'], sortable: ['applied_at', 'from_date', 'to_date', 'status', 'days'] }); }
  overlapping(employeeId: string, from: string, to: string, excludeId?: string, conn?: any): Promise<Row[]> {
    return this.db.query(
      `SELECT id, from_date, to_date, status FROM leave_applications WHERE employee_id = ? AND status IN ('PENDING','APPROVED') AND from_date <= ? AND to_date >= ? AND id <> ? FOR UPDATE`,
      [employeeId, to, from, excludeId ?? ''], conn);
  }
  duration(from: string, to: string, hs: boolean, he: boolean, holidays: number): Promise<number> {
    return this.db.scalar<number>('SELECT fn_leave_duration(?,?,?,?,?)', [from, to, hs ? 1 : 0, he ? 1 : 0, holidays]).then((v) => Number(v ?? 0));
  }
  calendar(from: string, to: string, employeeIds: string[] | null): Promise<Row[]> {
    const w = employeeIds ? `AND a.employee_id IN (${employeeIds.map(() => '?').join(',') || "''"})` : '';
    return this.db.query(
      `SELECT a.id, a.employee_id, a.employee_name, a.from_date, a.to_date, a.days, a.status, t.code AS leave_type_code, t.name AS leave_type_name
         FROM leave_applications a JOIN leave_types t ON t.id = a.leave_type_id
        WHERE a.status IN ('PENDING','APPROVED') AND a.from_date <= ? AND a.to_date >= ? ${w} ORDER BY a.from_date`, [to, from, ...(employeeIds ?? [])]);
  }
  pendingFor(stage: 'MANAGER' | 'HR', approverEmployeeId: string | null): Promise<Row[]> {
    if (stage === 'MANAGER') return this.db.query("SELECT * FROM leave_applications WHERE status = 'PENDING' AND stage = 'MANAGER' AND manager_id = ? ORDER BY applied_at", [approverEmployeeId]);
    return this.db.query("SELECT * FROM leave_applications WHERE status = 'PENDING' AND stage = 'HR' ORDER BY applied_at");
  }
  monthlySummary(employeeId: string, from: string, to: string): Promise<Row[]> {
    return this.db.query(
      `SELECT t.code, t.paid, SUM(a.days) AS days FROM leave_applications a JOIN leave_types t ON t.id = a.leave_type_id
        WHERE a.employee_id = ? AND a.status = 'APPROVED' AND a.from_date <= ? AND a.to_date >= ? GROUP BY t.code, t.paid`, [employeeId, to, from]);
  }
}

export class ApprovalRepository extends Repository { constructor(db: Db) { super(db, 'leave_approvals'); } }
export class CommentRepository extends Repository { constructor(db: Db) { super(db, 'leave_comments'); } }
export class AttachmentRepository extends Repository { constructor(db: Db) { super(db, 'leave_attachments'); } }
export class RunLogRepository extends Repository {
  constructor(db: Db) { super(db, 'leave_run_log', { pk: ['run_key'] }); }
}
