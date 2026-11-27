import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, audit, buildEvent, cache, enqueueOutbox, eachDay, hasPermission, key,
  pageRequest, today, addDays, diffDays, toDto, toDtos, toDtoPage, upsertRow, settleSections, Page,
} from '@hr/common';
import { EmployeeClient, HolidayClient } from '../clients/leave.clients';
import { leaveConfig } from '../config';
import { APPLICATION_FIELDS } from '../dto/leave.dto';
import {
  ApplicationRepository, ApprovalRepository, AttachmentRepository, CommentRepository, EmployeeSnapshotRepository, LeaveTypeRepository, PolicyRepository,
} from '../repositories/leave.repository';
import { BalanceService } from './balance.service';

type Stage = 'MANAGER' | 'HR' | 'COMPLETE';

export class LeaveApplicationService {
  private readonly apps: ApplicationRepository;
  private readonly approvals: ApprovalRepository;
  private readonly comments: CommentRepository;
  private readonly attachments: AttachmentRepository;
  private readonly types: LeaveTypeRepository;
  private readonly policies: PolicyRepository;
  private readonly snapshots: EmployeeSnapshotRepository;
  private readonly holidays = new HolidayClient();
  private readonly employeeClient = new EmployeeClient();

  constructor(private readonly db: Db, private readonly balances: BalanceService) {
    this.apps = new ApplicationRepository(db); this.approvals = new ApprovalRepository(db); this.comments = new CommentRepository(db); this.attachments = new AttachmentRepository(db);
    this.types = new LeaveTypeRepository(db); this.policies = new PolicyRepository(db); this.snapshots = new EmployeeSnapshotRepository(db);
  }

  // ------------------------------------------------------------------ helpers
  private async employee(id: string): Promise<Row> {
    const local = await this.snapshots.findById(id);
    if (local) return local;
    // read model not populated yet -> ask the Employee Service (synchronous) and remember the answer
    const e = await this.employeeClient.summary(id).catch(() => null);
    if (!e) throw new NotFoundError('Employee', id);
    const row = { employee_id: e.employeeId, department_id: e.departmentId, full_name: e.fullName, gender: e.gender, joining_date: e.joiningDate, location_id: e.locationId, manager_id: e.managerId, status: e.status, updated_at: new Date() };
    await upsertRow(this.db, 'leave_employees', row);
    return row;
  }

  private async duration(emp: Row, from: string, to: string, hs: boolean, he: boolean): Promise<number> {
    const hol = await this.holidays.weekdayHolidays(from, to, emp.location_id, emp.department_id).catch(() => [] as string[]);
    return this.apps.duration(from, to, hs, he, hol.length);
  }

  private canActOnStage(user: AuthUser, app: Row): boolean {
    if (app.employee_id === user.employeeId) return false; // never approve your own leave
    if (app.stage === 'MANAGER') return user.employeeId === app.manager_id || hasPermission(user, 'LEAVE_POLICY_MANAGE');
    if (app.stage === 'HR') return hasPermission(user, 'LEAVE_POLICY_MANAGE');
    return false;
  }

  private canView(user: AuthUser, app: Row): boolean {
    return app.employee_id === user.employeeId || app.manager_id === user.employeeId || hasPermission(user, 'LEAVE_POLICY_MANAGE', 'LEAVE_APPROVE') && (hasPermission(user, 'LEAVE_POLICY_MANAGE') || app.manager_id === user.employeeId);
  }

  private async record(conn: any, app: Row, action: string, stage: Stage, actorId: string | null, comment?: string): Promise<void> {
    await this.approvals.insert({ application_id: app.id, action, stage, actor_id: actorId, comment: comment ?? null }, conn);
    await audit(this.db, conn, 'LeaveApplication', app.id, action, undefined, { stage, comment });
  }

  private event(topic: string, app: Row, extra: Row = {}) {
    return buildEvent(topic, 'leave-service', {
      applicationId: app.id, employeeId: app.employee_id, employeeName: app.employee_name, managerId: app.manager_id, leaveTypeId: app.leave_type_id,
      leaveType: extra.leaveType, fromDate: app.from_date, toDate: app.to_date, days: app.days, stage: app.stage, status: app.status,
      dates: [...eachDay(app.from_date, app.to_date)], ...extra,
    }, app.employee_id);
  }

  // ------------------------------------------------------------------ apply
  async apply(dto: Row, actor: AuthUser) {
    const employeeId = dto.employeeId && hasPermission(actor, 'LEAVE_POLICY_MANAGE') ? dto.employeeId : actor.employeeId;
    if (!employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    if (dto.employeeId && dto.employeeId !== employeeId) throw new ForbiddenError('Only HR can apply on behalf of others');
    const emp = await this.employee(employeeId);
    if (!['ACTIVE', 'ON_NOTICE'].includes(emp.status)) throw new BusinessRuleError('Only active employees can apply for leave');
    const type = await this.types.getById(dto.leaveTypeId, 'Leave type');
    if (!type.active) throw new BusinessRuleError('This leave type is not active');
    if (type.gender_restriction && emp.gender && type.gender_restriction !== emp.gender) throw new BusinessRuleError(`${type.name} is not available to this employee`);
    if ((dto.halfDayStart || dto.halfDayEnd) && !type.half_day_allowed) throw new BusinessRuleError(`${type.name} does not allow half days`);
    if (dto.fromDate < addDays(today(), -leaveConfig.backdateDays)) throw new BusinessRuleError(`Leave cannot be back-dated by more than ${leaveConfig.backdateDays} days`);
    const days = await this.duration(emp, dto.fromDate, dto.toDate, dto.halfDayStart, dto.halfDayEnd);
    if (days <= 0) throw new BusinessRuleError('The selected dates contain no working days');
    if (type.attachment_required_from_days && days >= type.attachment_required_from_days && !dto.attachments.length) {
      throw new ValidationError(`${type.name} of ${type.attachment_required_from_days}+ days requires a supporting attachment`);
    }
    const year = Number(dto.fromDate.slice(0, 4));
    const policy = await this.policies.defaultPolicy();
    const hrNeeded = !!type.requires_hr_approval || (policy && days > Number(policy.hr_approval_threshold_days));

    const app = await this.db.tx(async (conn) => {
      if ((await this.apps.overlapping(employeeId, dto.fromDate, dto.toDate, undefined, conn)).length) throw new ConflictError('You already have a pending or approved leave overlapping these dates');
      if (type.balance_tracked) {
        const { row, available } = await this.balances.available(employeeId, type.id, year, conn, true);
        if (!row) throw new BusinessRuleError(`No ${type.name} balance exists for ${year}`);
        if (days > available) throw new BusinessRuleError(`Insufficient ${type.name} balance: requested ${days}, available ${available}`);
        await this.balances.balances.adjust(employeeId, type.id, year, { pending: days }, actor.username, conn);
      }
      const stage: Stage = emp.manager_id ? 'MANAGER' : 'HR';
      const row = await this.apps.insert({
        employee_id: employeeId, employee_name: emp.full_name, leave_type_id: type.id, from_date: dto.fromDate, to_date: dto.toDate, days, half_day_start: dto.halfDayStart ? 1 : 0, half_day_end: dto.halfDayEnd ? 1 : 0,
        reason: dto.reason ?? null, status: 'PENDING', stage, manager_id: emp.manager_id ?? null, applied_at: new Date(), cancel_requested: 0, version: 0,
      }, conn);
      for (const a of dto.attachments) await this.attachments.insert({ application_id: row.id, document_id: a.documentId, file_name: a.fileName ?? null }, conn);
      await this.record(conn, row, 'SUBMITTED', stage, actor.userId, dto.reason);
      await enqueueOutbox(this.db, conn, Topics.LEAVE_APPLIED, this.event(Topics.LEAVE_APPLIED, row, { leaveType: type.code, hrRequired: !!hrNeeded }));
      return row;
    });
    await this.balances.evict(employeeId);
    return this.get(app.id, actor);
  }

  // ------------------------------------------------------------------ update (only while pending at the first stage)
  async update(id: string, dto: Row, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (app.employee_id !== actor.employeeId) throw new ForbiddenError('Only the applicant can edit this application');
    if (app.status !== 'PENDING' || app.stage === 'COMPLETE') throw new BusinessRuleError('Only pending applications can be edited');
    const emp = await this.employee(app.employee_id);
    const from = dto.fromDate ?? app.from_date; const to = dto.toDate ?? app.to_date;
    if (to < from) throw new ValidationError('toDate must not precede fromDate');
    if (from.slice(0, 4) !== to.slice(0, 4)) throw new ValidationError('A leave request cannot span two calendar years');
    const typeId = dto.leaveTypeId ?? app.leave_type_id;
    const type = await this.types.getById(typeId, 'Leave type');
    const hs = dto.halfDayStart ?? !!app.half_day_start; const he = dto.halfDayEnd ?? !!app.half_day_end;
    if ((hs || he) && !type.half_day_allowed) throw new BusinessRuleError(`${type.name} does not allow half days`);
    const days = await this.duration(emp, from, to, hs, he);
    if (days <= 0) throw new BusinessRuleError('The selected dates contain no working days');
    await this.db.tx(async (conn) => {
      if ((await this.apps.overlapping(app.employee_id, from, to, id, conn)).length) throw new ConflictError('Updated dates overlap another leave');
      const oldYear = Number(String(app.from_date).slice(0, 4)); const newYear = Number(from.slice(0, 4));
      const oldType = await this.types.findById(app.leave_type_id, conn);
      if (oldType?.balance_tracked) await this.balances.balances.adjust(app.employee_id, app.leave_type_id, oldYear, { pending: -Number(app.days) }, actor.username, conn);
      if (type.balance_tracked) {
        const { row, available } = await this.balances.available(app.employee_id, type.id, newYear, conn, true);
        if (!row) throw new BusinessRuleError(`No ${type.name} balance exists for ${newYear}`);
        if (days > available) throw new BusinessRuleError(`Insufficient ${type.name} balance: requested ${days}, available ${available}`);
        await this.balances.balances.adjust(app.employee_id, type.id, newYear, { pending: days }, actor.username, conn);
      }
      await this.apps.update(id, { leave_type_id: typeId, from_date: from, to_date: to, days, half_day_start: hs ? 1 : 0, half_day_end: he ? 1 : 0, reason: dto.reason ?? app.reason }, conn);
      await this.record(conn, app, 'UPDATED', app.stage, actor.userId);
    });
    await this.balances.evict(app.employee_id);
    return this.get(id, actor);
  }

  // ------------------------------------------------------------------ approval workflow
  async approve(id: string, comment: string | undefined, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (app.status !== 'PENDING') throw new BusinessRuleError(`Application is already ${app.status}`);
    if (app.cancel_requested) throw new BusinessRuleError('Use the cancellation decision endpoints for this application');
    if (!this.canActOnStage(actor, app)) throw new ForbiddenError('You are not the approver for this stage');
    const type = await this.types.getById(app.leave_type_id, 'Leave type');
    const policy = await this.policies.defaultPolicy();
    const needsHr = app.stage === 'MANAGER' && (!!type.requires_hr_approval || (policy && Number(app.days) > Number(policy.hr_approval_threshold_days)));
    await this.db.tx(async (conn) => {
      if (needsHr) {
        await this.apps.update(id, { stage: 'HR' }, conn);
        await this.record(conn, app, 'MANAGER_APPROVED', 'MANAGER', actor.userId, comment);
        return;
      }
      await this.apps.update(id, { status: 'APPROVED', stage: 'COMPLETE', decided_at: new Date() }, conn);
      if (type.balance_tracked) await this.balances.balances.adjust(app.employee_id, app.leave_type_id, Number(String(app.from_date).slice(0, 4)), { pending: -Number(app.days), used: Number(app.days) }, actor.username, conn);
      await this.record(conn, app, app.stage === 'HR' ? 'HR_APPROVED' : 'MANAGER_APPROVED', app.stage, actor.userId, comment);
      await enqueueOutbox(this.db, conn, Topics.LEAVE_APPROVED, this.event(Topics.LEAVE_APPROVED, { ...app, status: 'APPROVED', stage: 'COMPLETE' }, { leaveType: type.code, approvedBy: actor.userId, comment, paid: !!type.paid }));
    });
    await this.balances.evict(app.employee_id);
    return this.get(id, actor);
  }

  async reject(id: string, comment: string, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (app.status !== 'PENDING') throw new BusinessRuleError(`Application is already ${app.status}`);
    if (!this.canActOnStage(actor, app)) throw new ForbiddenError('You are not the approver for this stage');
    const type = await this.types.getById(app.leave_type_id, 'Leave type');
    await this.db.tx(async (conn) => {
      if (app.cancel_requested) {
        await this.apps.update(id, { cancel_requested: 0 }, conn); // approved leave stays approved; status untouched (it is PENDING only if cancel flow is used on pending rows)
        await this.record(conn, app, 'CANCEL_REJECTED', app.stage, actor.userId, comment);
        return;
      }
      await this.apps.update(id, { status: 'REJECTED', stage: 'COMPLETE', decided_at: new Date() }, conn);
      if (type.balance_tracked) await this.balances.balances.adjust(app.employee_id, app.leave_type_id, Number(String(app.from_date).slice(0, 4)), { pending: -Number(app.days) }, actor.username, conn);
      await this.record(conn, app, 'REJECTED', app.stage, actor.userId, comment);
      await enqueueOutbox(this.db, conn, Topics.LEAVE_REJECTED, this.event(Topics.LEAVE_REJECTED, { ...app, status: 'REJECTED', stage: 'COMPLETE' }, { leaveType: type.code, rejectedBy: actor.userId, comment }));
    });
    await this.balances.evict(app.employee_id);
    return this.get(id, actor);
  }

  /** Applicant withdraws a still-pending application (balance reservation released). */
  async withdraw(id: string, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (app.employee_id !== actor.employeeId) throw new ForbiddenError('Only the applicant can withdraw');
    if (app.status !== 'PENDING') throw new BusinessRuleError('Only pending applications can be withdrawn; request cancellation for approved leave');
    const type = await this.types.getById(app.leave_type_id, 'Leave type');
    await this.db.tx(async (conn) => {
      await this.apps.update(id, { status: 'WITHDRAWN', stage: 'COMPLETE', decided_at: new Date() }, conn);
      if (type.balance_tracked) await this.balances.balances.adjust(app.employee_id, app.leave_type_id, Number(String(app.from_date).slice(0, 4)), { pending: -Number(app.days) }, actor.username, conn);
      await this.record(conn, app, 'WITHDRAWN', app.stage, actor.userId);
      await enqueueOutbox(this.db, conn, Topics.LEAVE_CANCELLED, this.event(Topics.LEAVE_CANCELLED, { ...app, status: 'WITHDRAWN' }, { leaveType: type.code, reason: 'withdrawn by employee' }));
    });
    await this.balances.evict(app.employee_id);
    return this.get(id, actor);
  }

  /** Cancelling APPROVED leave needs approval: employee requests, manager/HR decides. */
  async requestCancellation(id: string, reason: string, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (app.employee_id !== actor.employeeId) throw new ForbiddenError('Only the applicant can request cancellation');
    if (app.status !== 'APPROVED') throw new BusinessRuleError('Only approved leave needs a cancellation request');
    if (app.cancel_requested) throw new ConflictError('A cancellation request is already pending');
    if (app.to_date < today()) throw new BusinessRuleError('Leave that has already finished cannot be cancelled');
    await this.db.tx(async (conn) => {
      await this.apps.update(id, { cancel_requested: 1, cancel_reason: reason, stage: app.manager_id ? 'MANAGER' : 'HR' }, conn);
      await this.record(conn, app, 'CANCEL_REQUESTED', app.manager_id ? 'MANAGER' : 'HR', actor.userId, reason);
    });
    return this.get(id, actor);
  }

  async decideCancellation(id: string, approve: boolean, comment: string | undefined, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (!app.cancel_requested || app.status !== 'APPROVED') throw new BusinessRuleError('No cancellation request is pending');
    if (!this.canActOnStage(actor, app)) throw new ForbiddenError('You are not the approver for this stage');
    const type = await this.types.getById(app.leave_type_id, 'Leave type');
    await this.db.tx(async (conn) => {
      if (!approve) {
        await this.apps.update(id, { cancel_requested: 0, cancel_reason: null, stage: 'COMPLETE' }, conn);
        await this.record(conn, app, 'CANCEL_REJECTED', app.stage, actor.userId, comment);
        return;
      }
      await this.apps.update(id, { status: 'CANCELLED', stage: 'COMPLETE', cancel_requested: 0, decided_at: new Date() }, conn);
      if (type.balance_tracked) await this.balances.balances.adjust(app.employee_id, app.leave_type_id, Number(String(app.from_date).slice(0, 4)), { used: -Number(app.days) }, actor.username, conn);
      await this.record(conn, app, 'CANCEL_APPROVED', app.stage, actor.userId, comment);
      await enqueueOutbox(this.db, conn, Topics.LEAVE_CANCELLED, this.event(Topics.LEAVE_CANCELLED, { ...app, status: 'CANCELLED' }, { leaveType: type.code, reason: app.cancel_reason }));
    });
    await this.balances.evict(app.employee_id);
    return this.get(id, actor);
  }

  // ------------------------------------------------------------------ reads
  async get(id: string, viewer: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (!this.canView(viewer, app)) throw new ForbiddenError('You are not allowed to view this application');
    const [approvals, comments, attachments, type] = await Promise.all([
      this.approvals.findAll({ application_id: id }, { by: 'created_at' }), this.comments.findAll({ application_id: id }, { by: 'created_at' }),
      this.attachments.findAll({ application_id: id }), this.types.findById(app.leave_type_id),
    ]);
    return { ...toDto(app, APPLICATION_FIELDS), leaveTypeCode: type?.code, leaveTypeName: type?.name, approvals: toDtos(approvals), comments: toDtos(comments), attachments: toDtos(attachments) };
  }

  /** Employees see their own; managers see their team's; HR sees everyone's. */
  async list(q: Row, viewer: AuthUser): Promise<Page<Row>> {
    const hr = hasPermission(viewer, 'LEAVE_POLICY_MANAGE');
    const where: Row = {};
    if (q.status) where.status = q.status;
    if (q.stage) where.stage = q.stage;
    if (q.leaveTypeId) where.leave_type_id = q.leaveTypeId;
    if (q.from) where.from_date = { op: '>=', value: q.from };
    if (hr) { if (q.employeeId) where.employee_id = q.employeeId; }
    else if (q.employeeId && q.employeeId !== viewer.employeeId) {
      const emp = await this.snapshots.findById(q.employeeId);
      if (!emp || emp.manager_id !== viewer.employeeId) throw new ForbiddenError('You may only list your own or your reports\' leave');
      where.employee_id = q.employeeId;
    } else where.employee_id = viewer.employeeId ?? '-';
    if (q.to) where.to_date = { op: '<=', value: q.to };
    return toDtoPage(await this.apps.page(where, pageRequest(q), q.q), APPLICATION_FIELDS);
  }

  async pendingApprovals(viewer: AuthUser) {
    const mgr = await this.apps.pendingFor('MANAGER', viewer.employeeId);
    const hr = hasPermission(viewer, 'LEAVE_POLICY_MANAGE') ? await this.apps.pendingFor('HR', null) : [];
    return toDtos([...mgr, ...hr].filter((a) => a.employee_id !== viewer.employeeId), APPLICATION_FIELDS);
  }

  async addComment(id: string, comment: string, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (!this.canView(actor, app)) throw new ForbiddenError();
    return toDto(await this.comments.insert({ application_id: id, author_id: actor.employeeId ?? actor.userId, comment }));
  }

  async addAttachment(id: string, documentId: string, fileName: string | undefined, actor: AuthUser) {
    const app = await this.apps.getById(id, 'Leave application');
    if (app.employee_id !== actor.employeeId && !hasPermission(actor, 'LEAVE_POLICY_MANAGE')) throw new ForbiddenError();
    return toDto(await this.attachments.insert({ application_id: id, document_id: documentId, file_name: fileName ?? null }));
  }

  // ------------------------------------------------------------------ calendars
  async calendar(from: string, to: string, employeeId: string) {
    if (diffDays(from, to) > 366) throw new ValidationError('Calendar range cannot exceed one year');
    return toDtos(await this.apps.calendar(from, to, [employeeId]));
  }

  async teamCalendar(from: string, to: string, viewer: AuthUser) {
    if (diffDays(from, to) > 366) throw new ValidationError('Calendar range cannot exceed one year');
    const team = hasPermission(viewer, 'LEAVE_POLICY_MANAGE') ? null
      : (await this.snapshots.findAll({ manager_id: viewer.employeeId ?? '-' })).map((e) => e.employee_id as string);
    return toDtos(await this.apps.calendar(from, to, team));
  }

  async upcoming(viewer: AuthUser, days = 14) {
    return this.teamCalendar(today(), addDays(today(), days), viewer);
  }

  /** Used by Payroll: approved leave days in a month split into paid / unpaid. */
  async monthlySummary(employeeId: string, month: string) {
    const from = `${month}-01`; const [y, m] = month.split('-').map(Number);
    const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
    const rows = await this.apps.monthlySummary(employeeId, from, to);
    const unpaid = rows.filter((r) => !r.paid).reduce((a, r) => a + Number(r.days), 0);
    const paid = rows.filter((r) => r.paid).reduce((a, r) => a + Number(r.days), 0);
    return { employeeId, month, paidLeaveDays: paid, unpaidLeaveDays: unpaid, byType: toDtos(rows) };
  }

  /** Employee leave overview: balance + upcoming leave + pending, gathered concurrently (Promise.allSettled). */
  async overview(employeeId: string, year: number) {
    const { data, unavailable } = await settleSections({
      balances: () => this.balances.forEmployee(employeeId, year),
      upcoming: () => this.calendar(today(), addDays(today(), 60), employeeId),
      pending: () => this.apps.findAll({ employee_id: employeeId, status: 'PENDING' }).then((r) => toDtos(r, APPLICATION_FIELDS)),
    });
    return { ...data, unavailable };
  }
}
void cache; void key;
