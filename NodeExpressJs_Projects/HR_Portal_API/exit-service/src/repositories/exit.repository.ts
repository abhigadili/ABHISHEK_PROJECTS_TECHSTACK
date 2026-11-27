import { Db, Repository, Row } from '@hr/common';

export class ResignationRepository extends Repository {
  constructor(db: Db) { super(db, 'resignations', { searchable: ['employee_name'], sortable: ['submitted_on', 'status', 'created_at', 'confirmed_last_working_day'] }); }
  active(employeeId: string): Promise<Row | null> {
    return this.db.one("SELECT * FROM resignations WHERE employee_id = ? AND status NOT IN ('MANAGER_REJECTED','WITHDRAWN','COMPLETED') LIMIT 1", [employeeId]);
  }
}
export class TaskRepository extends Repository {
  constructor(db: Db) { super(db, 'exit_tasks'); }
  forResignation(id: string, conn?: any): Promise<Row[]> { return this.db.query('SELECT * FROM exit_tasks WHERE resignation_id = ? ORDER BY task_type, title', [id], conn); }
}
export class HistoryRepository extends Repository {
  constructor(db: Db) { super(db, 'exit_history'); }
  add(conn: any, resignationId: string, from: string | null, to: string, comment?: string) { return this.insert({ resignation_id: resignationId, from_status: from, to_status: to, comment: comment ?? null }, conn); }
  forResignation(id: string): Promise<Row[]> { return this.db.query('SELECT * FROM exit_history WHERE resignation_id = ? ORDER BY created_at', [id]); }
}
export class FormRepository extends Repository { constructor(db: Db) { super(db, 'exit_interview_forms'); } }
export class InterviewRepository extends Repository { constructor(db: Db) { super(db, 'exit_interviews'); } }
export class PolicyRepository extends Repository {
  constructor(db: Db) { super(db, 'exit_policy'); }
  async current(): Promise<Row> {
    return (await this.db.one<Row>('SELECT * FROM exit_policy ORDER BY created_at DESC LIMIT 1')) ?? { default_notice_days: 60, max_waiver_days: 30, salary_days_per_month: 30, withdrawal_after_confirmation: 0 };
  }
}
export class SettlementRepository extends Repository {
  constructor(db: Db) { super(db, 'settlements'); }
  lines(id: string, conn?: any): Promise<Row[]> { return this.db.query('SELECT * FROM settlement_lines WHERE settlement_id = ? ORDER BY type DESC, created_at', [id], conn); }
  summary(resignationId: string): Promise<Row[]> { return this.db.callProcedure('sp_exit_settlement_summary', [resignationId]); }
}
