import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, addDays, audit, buildEvent, diffDays, enqueueOutbox, hasPermission, pageRequest,
  toDto, toDtos, toDtoPage, today,
} from '@hr/common';
import { EmployeeClient } from '../clients/exit.clients';
import { HistoryRepository, PolicyRepository, ResignationRepository, SettlementRepository, TaskRepository, FormRepository, InterviewRepository } from '../repositories/exit.repository';

type Status = 'SUBMITTED' | 'MANAGER_APPROVED' | 'MANAGER_REJECTED' | 'HR_CONFIRMED' | 'CLEARED' | 'INTERVIEW_DONE' | 'SETTLEMENT_PENDING' | 'COMPLETED' | 'WITHDRAWN';
const CLEARANCE_DEPARTMENTS = ['MANAGER', 'HR', 'FINANCE', 'IT', 'ADMIN'];

export class ResignationService {
  readonly resignations: ResignationRepository; readonly tasks: TaskRepository; readonly history: HistoryRepository; readonly policy: PolicyRepository; readonly settlements: SettlementRepository;
  private readonly interviews: InterviewRepository; private readonly forms: FormRepository; private readonly employees = new EmployeeClient();

  constructor(private readonly db: Db) {
    this.resignations = new ResignationRepository(db); this.tasks = new TaskRepository(db); this.history = new HistoryRepository(db); this.policy = new PolicyRepository(db);
    this.settlements = new SettlementRepository(db); this.interviews = new InterviewRepository(db); this.forms = new FormRepository(db);
  }

  private async load(id: string): Promise<Row> { return this.resignations.getById(id, 'Resignation'); }
  async assertView(u: AuthUser, r: Row): Promise<void> {
    if (r.employee_id === u.employeeId || r.manager_id === u.employeeId || hasPermission(u, 'EXIT_MANAGE', 'EXIT_APPROVE', 'PAYROLL_PROCESS', 'PAYROLL_VIEW')) return;
    throw new ForbiddenError('You are not allowed to view this resignation');
  }
  async transition(conn: any, r: Row, to: Status, patch: Row = {}, comment?: string): Promise<void> {
    await this.resignations.update(r.id, { status: to, ...patch }, conn);
    await this.history.add(conn, r.id, r.status, to, comment);
    await audit(this.db, conn, 'Resignation', r.id, `STATUS_${to}`, { status: r.status }, { status: to, comment });
  }

  // ---------------------------------------------------------------- step 1: employee submits
  /** Notice period calculation: last working day = submitted + (notice - waiver); a shorter request needs a waiver within policy limits. */
  async submit(u: AuthUser, dto: { reason: string; requestedLastWorkingDay: string }) {
    if (!u.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    const emp = await this.employees.summary(u.employeeId);
    if (emp.status !== 'ACTIVE') throw new BusinessRuleError('Only active employees can resign');
    if (await this.resignations.active(u.employeeId)) throw new ConflictError('You already have an open resignation');
    const policy = await this.policy.current();
    const notice = emp.noticePeriodDays || Number(policy.default_notice_days);
    const submittedOn = today();
    if (dto.requestedLastWorkingDay <= submittedOn) throw new ValidationError('The last working day must be after today');
    if (emp.joiningDate && dto.requestedLastWorkingDay <= emp.joiningDate) throw new ValidationError('The last working day must be after the joining date');
    const required = addDays(submittedOn, notice);
    const waiver = Math.max(0, diffDays(dto.requestedLastWorkingDay, required));
    if (waiver > Number(policy.max_waiver_days)) throw new BusinessRuleError(`Requested date is ${waiver} days short of the ${notice}-day notice; the maximum waiver is ${policy.max_waiver_days} days`);
    const r = await this.db.tx(async (conn) => {
      const row = await this.resignations.insert({
        employee_id: u.employeeId, employee_name: emp.fullName, manager_id: emp.managerId, department_id: emp.departmentId, joining_date: emp.joiningDate, notice_period_days: notice, reason: dto.reason,
        requested_last_working_day: dto.requestedLastWorkingDay, submitted_on: submittedOn, status: 'SUBMITTED', waiver_days: waiver, version: 0,
      }, conn);
      await this.history.add(conn, row.id, null, 'SUBMITTED', dto.reason); await audit(this.db, conn, 'Resignation', row.id, 'SUBMITTED', undefined, { requested: dto.requestedLastWorkingDay, waiver });
      await enqueueOutbox(this.db, conn, Topics.RESIGNATION_SUBMITTED, buildEvent(Topics.RESIGNATION_SUBMITTED, 'exit-service', { resignationId: row.id, employeeId: u.employeeId, employeeName: emp.fullName, managerId: emp.managerId, requestedLastWorkingDay: dto.requestedLastWorkingDay, requiredNoticeEnd: required, waiverDays: waiver }, u.employeeId!));
      return row;
    });
    return this.get(r.id, u);
  }

  // ---------------------------------------------------------------- step 2: manager reviews
  async managerDecision(u: AuthUser, id: string, approve: boolean, comment?: string) {
    const r = await this.load(id);
    if (r.status !== 'SUBMITTED') throw new BusinessRuleError(`Resignation is ${r.status}`);
    if (r.employee_id === u.employeeId) throw new ForbiddenError('You cannot review your own resignation');
    if (r.manager_id !== u.employeeId && !hasPermission(u, 'EXIT_MANAGE')) throw new ForbiddenError('Only the reporting manager can review');
    await this.db.tx(async (conn) => this.transition(conn, r, approve ? 'MANAGER_APPROVED' : 'MANAGER_REJECTED', { manager_comment: comment ?? null }, comment));
    return this.get(id, u);
  }

  // ---------------------------------------------------------------- step 3: HR confirms the last working day, creating the exit checklist
  async hrConfirm(u: AuthUser, id: string, dto: { lastWorkingDay: string; waiverDays: number; comment?: string }) {
    const r = await this.load(id);
    if (r.status !== 'MANAGER_APPROVED') throw new BusinessRuleError('Resignation must be approved by the manager first');
    const policy = await this.policy.current();
    if (dto.waiverDays > Number(policy.max_waiver_days)) throw new BusinessRuleError(`Waiver cannot exceed ${policy.max_waiver_days} days`);
    const earliest = addDays(r.submitted_on, Number(r.notice_period_days) - dto.waiverDays);
    if (dto.lastWorkingDay < earliest) throw new BusinessRuleError(`Last working day cannot be before ${earliest} (notice ${r.notice_period_days} days minus waiver ${dto.waiverDays})`);
    await this.db.tx(async (conn) => {
      await this.transition(conn, r, 'HR_CONFIRMED', { confirmed_last_working_day: dto.lastWorkingDay, waiver_days: dto.waiverDays, hr_comment: dto.comment ?? null }, dto.comment);
      const due = dto.lastWorkingDay;
      const base = (type: string, title: string, extra: Row = {}) => this.tasks.insert({ resignation_id: id, task_type: type, title, status: 'PENDING', due_date: due, ...extra }, conn);
      await base('CHECKLIST', 'Hand over documents and complete the leaver form');
      await base('KT', 'Knowledge transfer to the team');
      await base('ASSET', 'Return company assets (laptop, access card)');
      await base('ACCESS', 'Revoke system access');
      for (const d of CLEARANCE_DEPARTMENTS) await base('CLEARANCE', `${d} clearance`, { department: d });
      await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'exit-service', { type: 'EXIT_LWD_CONFIRMED', recipientEmployeeId: r.employee_id, subject: 'Last working day confirmed', body: `Your last working day is ${dto.lastWorkingDay}. Please complete your exit checklist.`, referenceType: 'Resignation', referenceId: id }, r.employee_id));
    });
    return this.get(id, u);
  }

  async withdraw(u: AuthUser, id: string, reason?: string) {
    const r = await this.load(id);
    if (r.employee_id !== u.employeeId) throw new ForbiddenError('Only the employee can withdraw');
    const policy = await this.policy.current();
    const allowed = r.status === 'SUBMITTED' || r.status === 'MANAGER_APPROVED' || (r.status === 'HR_CONFIRMED' && policy.withdrawal_after_confirmation);
    if (!allowed) throw new BusinessRuleError(`A resignation in status ${r.status} cannot be withdrawn`);
    await this.db.tx(async (conn) => {
      await this.transition(conn, r, 'WITHDRAWN', {}, reason);
      await this.db.exec("DELETE FROM exit_tasks WHERE resignation_id = ? AND status = 'PENDING'", [id], conn);
      await enqueueOutbox(this.db, conn, Topics.RESIGNATION_WITHDRAWN, buildEvent(Topics.RESIGNATION_WITHDRAWN, 'exit-service', { resignationId: id, employeeId: r.employee_id, reason: reason ?? null }, r.employee_id));
    });
    return this.get(id, u);
  }

  // ---------------------------------------------------------------- reads
  async get(id: string, u: AuthUser) {
    const r = await this.load(id); await this.assertView(u, r);
    const [tasks, history, interview, settlement] = await Promise.all([
      this.tasks.forResignation(id), this.history.forResignation(id), this.interviews.findOne({ resignation_id: id }), this.settlements.findOne({ resignation_id: id }),
    ]);
    const settlementView = settlement && hasPermission(u, 'EXIT_MANAGE', 'PAYROLL_PROCESS', 'PAYROLL_VIEW') ? { ...toDto(settlement), lines: toDtos(await this.settlements.lines(settlement.id)) } : null;
    const done = tasks.filter((t) => t.status === 'DONE').length;
    return { ...toDto(r), noticeEnd: r.submitted_on ? addDays(r.submitted_on, Number(r.notice_period_days) - Number(r.waiver_days)) : null, progress: { tasksDone: done, tasksTotal: tasks.length },
      tasks: toDtos(tasks), history: toDtos(history), interview: interview ? toDto(interview) : null, settlement: settlementView };
  }
  async mine(u: AuthUser) { const r = u.employeeId ? await this.resignations.findOne({ employee_id: u.employeeId }) : null; return r ? this.get(r.id, u) : null; }

  async list(u: AuthUser, q: Row) {
    const where: Row = {}; if (q.status) where.status = q.status;
    if (hasPermission(u, 'EXIT_MANAGE', 'PAYROLL_PROCESS')) { if (q.employeeId) where.employee_id = q.employeeId; }
    else if (hasPermission(u, 'EXIT_APPROVE')) where.manager_id = u.employeeId ?? '-';
    else where.employee_id = u.employeeId ?? '-';
    return toDtoPage(await this.resignations.page(where, pageRequest(q), q.q));
  }

  async policyGet() { return toDto(await this.policy.current()); }
  async policyUpdate(dto: Row) {
    const cur = await this.db.one<Row>('SELECT id FROM exit_policy ORDER BY created_at DESC LIMIT 1');
    const row = { default_notice_days: dto.defaultNoticeDays, max_waiver_days: dto.maxWaiverDays, salary_days_per_month: dto.salaryDaysPerMonth, withdrawal_after_confirmation: dto.withdrawalAfterConfirmation ? 1 : 0 };
    if (cur) await this.policy.update(cur.id, row); else await this.policy.insert(row);
    await audit(this.db, undefined, 'ExitPolicy', 'policy', 'UPDATED', undefined, dto);
    return this.policyGet();
  }
}
void NotFoundError;
