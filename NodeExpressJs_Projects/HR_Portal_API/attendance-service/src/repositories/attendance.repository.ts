import { Db, Repository, Row, upsertRow } from '@hr/common';

export class ShiftRepository extends Repository {
  constructor(db: Db) { super(db, 'shifts', { softDelete: true }); }
  defaultShift(): Promise<Row | null> { return this.db.one('SELECT * FROM shifts WHERE deleted = 0 AND active = 1 ORDER BY is_default DESC, created_at LIMIT 1'); }
  forEmployee(employeeId: string, date: string): Promise<Row | null> {
    return this.db.one(
      `SELECT s.* FROM shift_assignments a JOIN shifts s ON s.id = a.shift_id
        WHERE a.employee_id = ? AND a.effective_from <= ? AND (a.effective_to IS NULL OR a.effective_to >= ?) AND s.deleted = 0 ORDER BY a.effective_from DESC LIMIT 1`, [employeeId, date, date]);
  }
}
export class ShiftAssignmentRepository extends Repository {
  constructor(db: Db) { super(db, 'shift_assignments'); }
  overlapping(employeeId: string, from: string, to: string | null, conn?: any): Promise<Row[]> {
    return this.db.query('SELECT * FROM shift_assignments WHERE employee_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)', [employeeId, to ?? '9999-12-31', from], conn);
  }
}

export class RecordRepository extends Repository {
  constructor(db: Db) { super(db, 'attendance_records', { sortable: ['work_date', 'check_in', 'status', 'worked_minutes'] }); }
  forDay(employeeId: string, date: string, conn?: any, lock = false): Promise<Row | null> {
    return this.db.one(`SELECT * FROM attendance_records WHERE employee_id = ? AND work_date = ? ${lock ? 'FOR UPDATE' : ''}`, [employeeId, date], conn);
  }
  range(employeeId: string, from: string, to: string): Promise<Row[]> {
    return this.db.query('SELECT * FROM attendance_records WHERE employee_id = ? AND work_date BETWEEN ? AND ? ORDER BY work_date', [employeeId, from, to]);
  }
  openBefore(date: string): Promise<Row[]> {
    return this.db.query("SELECT * FROM attendance_records WHERE check_in IS NOT NULL AND check_out IS NULL AND status <> 'MISSING_PUNCH' AND work_date < ?", [date]);
  }
  overtime(worked: number, standard: number, threshold: number): Promise<number> {
    return this.db.scalar<number>('SELECT fn_overtime_minutes(?,?,?)', [worked, standard, threshold]).then((v) => Number(v ?? 0));
  }
  teamDay(employeeIds: string[], date: string): Promise<Row[]> {
    if (!employeeIds.length) return Promise.resolve([]);
    return this.db.query(`SELECT * FROM attendance_records WHERE work_date = ? AND employee_id IN (${employeeIds.map(() => '?').join(',')})`, [date, ...employeeIds]);
  }
}

export class CorrectionRepository extends Repository { constructor(db: Db) { super(db, 'attendance_corrections', { sortable: ['created_at', 'work_date', 'status'] }); } }
export class WfhRepository extends Repository {
  constructor(db: Db) { super(db, 'wfh_requests', { sortable: ['created_at', 'from_date', 'status'] }); }
  approvedCovering(employeeId: string, date: string): Promise<Row | null> {
    return this.db.one("SELECT * FROM wfh_requests WHERE employee_id = ? AND status = 'APPROVED' AND from_date <= ? AND to_date >= ? LIMIT 1", [employeeId, date, date]);
  }
}
export class EmployeeSnapshotRepository extends Repository {
  constructor(db: Db) { super(db, 'attendance_employees', { pk: ['employee_id'] }); }
}

export class CalendarRepository {
  constructor(private readonly db: Db) {}
  isHoliday(date: string, locationId: string | null): Promise<Row | null> {
    return this.db.one('SELECT * FROM holiday_snapshots WHERE holiday_date = ? AND (location_id IS NULL OR location_id = ?) LIMIT 1', [date, locationId ?? '']);
  }
  isOnLeave(employeeId: string, date: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM approved_leave_days WHERE employee_id = ? AND leave_date = ? LIMIT 1', [employeeId, date]);
  }
  holidays(from: string, to: string, locationId: string | null): Promise<Row[]> {
    return this.db.query('SELECT * FROM holiday_snapshots WHERE holiday_date BETWEEN ? AND ? AND (location_id IS NULL OR location_id = ?) ORDER BY holiday_date', [from, to, locationId ?? '']);
  }
  leaveDays(employeeId: string, from: string, to: string): Promise<Row[]> {
    return this.db.query('SELECT leave_date FROM approved_leave_days WHERE employee_id = ? AND leave_date BETWEEN ? AND ?', [employeeId, from, to]);
  }
  async addLeaveDays(applicationId: string, employeeId: string, dates: string[], conn: any): Promise<void> {
    await this.db.exec('DELETE FROM approved_leave_days WHERE application_id = ?', [applicationId], conn);
    for (const d of dates) await this.db.exec('INSERT INTO approved_leave_days (id, created_at, updated_at, application_id, employee_id, leave_date) VALUES (UUID(),?,?,?,?,?)', [new Date(), new Date(), applicationId, employeeId, d], conn);
  }
  removeLeaveDays(applicationId: string, conn: any) { return this.db.exec('DELETE FROM approved_leave_days WHERE application_id = ?', [applicationId], conn); }
  upsertHoliday(row: Row) { return upsertRow(this.db, 'holiday_snapshots', row); }
  summary(employeeId: string, year: number, month: number): Promise<Row | null> {
    return this.db.one('SELECT * FROM vw_monthly_attendance_summary WHERE employee_id = ? AND summary_year = ? AND summary_month = ?', [employeeId, year, month]);
  }
  runSummary(employeeId: string, year: number, month: number, locationId: string | null): Promise<Row[]> {
    return this.db.callProcedure('sp_monthly_attendance_summary', [employeeId, year, month, locationId ?? '']);
  }
}
