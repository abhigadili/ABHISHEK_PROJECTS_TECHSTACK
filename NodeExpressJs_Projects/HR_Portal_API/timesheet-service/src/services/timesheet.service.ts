import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, addDays, audit, buildEvent, enqueueOutbox, groupBy, hasPermission, pageRequest, round2, sum,
  today, toDto, toDtos, toDtoPage, upsertRow, weekStart, withTimeout, diffDays,
} from '@hr/common';
import { ProjectClient, AllocationCheck } from '../clients/project.client';
import { timesheetConfig } from '../config';
import { EmployeeSnapshotRepository, EntryRepository, HistoryRepository, TaskRepository, TimesheetRepository } from '../repositories/timesheet.repository';

const SHEET_FIELDS = ['id', 'employeeId', 'employeeName', 'weekStart', 'status', 'totalHours', 'billableHours', 'approverId', 'submittedAt', 'decidedAt', 'decisionComment', 'resubmissionCount', 'version'];
type Entry = { projectId: string; taskId?: string; taskKey?: string; workDate: string; hours: number; billable: boolean; description?: string };

export class TimesheetService {
  private readonly sheets: TimesheetRepository; private readonly entries: EntryRepository; private readonly tasks: TaskRepository; private readonly history: HistoryRepository; private readonly employees: EmployeeSnapshotRepository;
  private readonly projects = new ProjectClient();
  constructor(private readonly db: Db) { this.sheets = new TimesheetRepository(db); this.entries = new EntryRepository(db); this.tasks = new TaskRepository(db); this.history = new HistoryRepository(db); this.employees = new EmployeeSnapshotRepository(db); }

  private requireEmployee(u: AuthUser): string { if (!u.employeeId) throw new ForbiddenError('Your account is not linked to an employee'); return u.employeeId; }
  private async employee(id: string): Promise<Row> { const e = await this.employees.findById(id); if (!e) throw new NotFoundError('Employee', id); return e; }

  private async canApprove(u: AuthUser, sheet: Row): Promise<boolean> {
    if (sheet.employee_id === u.employeeId) return false;
    if (sheet.approver_id === u.employeeId || u.roles.includes('SUPER_ADMIN')) return true;
    if (!hasPermission(u, 'TIMESHEET_APPROVE')) return false;
    return !!(await this.db.one('SELECT id FROM timesheet_entries WHERE timesheet_id = ? AND project_manager_id = ? LIMIT 1', [sheet.id, u.employeeId ?? '-']));
  }
  private async assertView(u: AuthUser, sheet: Row): Promise<void> {
    if (sheet.employee_id === u.employeeId || hasPermission(u, 'REPORT_VIEW') || (await this.canApprove(u, sheet))) return;
    throw new ForbiddenError('You are not allowed to view this timesheet');
  }

  /** Validates every entry against the Project Service (allocation) with concurrent, de-duplicated calls. */
  private async validateEntries(employeeId: string, ws: string, list: Entry[]): Promise<Map<string, AllocationCheck>> {
    const we = addDays(ws, 6); const t = today();
    const seen = new Set<string>(); const daily = new Map<string, number>();
    for (const e of list) {
      if (e.workDate < ws || e.workDate > we) throw new ValidationError(`Entry date ${e.workDate} is outside the week ${ws}..${we}`);
      if (e.workDate > t) throw new ValidationError(`Entry date ${e.workDate} is in the future`);
      const k = `${e.projectId}|${e.taskId ?? e.taskKey}|${e.workDate}`;
      if (seen.has(k)) throw new ConflictError(`Duplicate entry for project/task on ${e.workDate}`);
      seen.add(k);
      daily.set(e.workDate, (daily.get(e.workDate) ?? 0) + e.hours);
    }
    for (const [d, h] of daily) if (h > timesheetConfig.maxHoursPerDay) throw new BusinessRuleError(`${d}: ${h}h exceeds the daily limit of ${timesheetConfig.maxHoursPerDay}h`);
    const total = sum(list.map((e) => e.hours)); if (total > timesheetConfig.maxHoursPerWeek) throw new BusinessRuleError(`Weekly total ${total}h exceeds the limit of ${timesheetConfig.maxHoursPerWeek}h`);
    const pairs = [...new Set(list.map((e) => `${e.projectId}|${e.workDate}`))];
    const checks = await Promise.all(pairs.map((p) => { const [projectId, date] = p.split('|'); return withTimeout(this.projects.check(projectId, employeeId, date), 6000, 'project-service').then((c) => [p, c] as const); }));
    const map = new Map(checks);
    for (const [p, c] of map) if (!c.allocated) throw new BusinessRuleError(`You are not allocated to project ${c.projectCode} on ${p.split('|')[1]} (or the project is not active)`);
    // tasks, when referenced by id, must belong to the project and be active
    for (const e of list.filter((x) => x.taskId)) {
      const task = await this.tasks.findById(e.taskId!);
      if (!task || task.project_id !== e.projectId || !task.active) throw new ValidationError(`Task ${e.taskId} is not valid for project ${e.projectId}`);
    }
    return map;
  }

  async getWeek(employeeId: string, ws: string, viewer: AuthUser) {
    const monday = weekStart(ws);
    const sheet = await this.sheets.byWeek(employeeId, monday);
    if (!sheet) { if (employeeId !== viewer.employeeId && !hasPermission(viewer, 'REPORT_VIEW')) throw new ForbiddenError(); return { weekStart: monday, employeeId, status: 'NOT_STARTED', entries: [], totalHours: 0 }; }
    await this.assertView(viewer, sheet);
    return this.view(sheet);
  }
  private async view(sheet: Row) {
    const [entries, history] = await Promise.all([this.entries.forSheet(sheet.id), this.history.findAll({ timesheet_id: sheet.id }, { by: 'created_at' })]);
    const byDay = [...groupBy(entries, (e: Row) => e.work_date as string).entries()].map(([date, es]) => ({ date, hours: round2(sum(es.map((e) => e.hours))) }));
    return { ...toDto(sheet, SHEET_FIELDS), entries: toDtos(entries), dailyTotals: byDay, history: toDtos(history) };
  }

  /** Replaces the week's entries (DRAFT or REJECTED only). Creates the timesheet on first save. */
  async saveWeek(u: AuthUser, rawWeek: string, list: Entry[]) {
    const employeeId = this.requireEmployee(u); const ws = weekStart(rawWeek);
    const emp = await this.employee(employeeId);
    if (!['ACTIVE', 'ON_NOTICE'].includes(emp.status)) throw new BusinessRuleError('Only active employees can log time');
    const checks = await this.validateEntries(employeeId, ws, list);
    const id = await this.db.tx(async (conn) => {
      let sheet = await this.sheets.byWeek(employeeId, ws, conn, true);
      if (sheet && !['DRAFT', 'REJECTED'].includes(sheet.status)) throw new BusinessRuleError(`A ${sheet.status} timesheet cannot be edited; reopen it first`);
      if (!sheet) {
        sheet = await this.sheets.insert({ employee_id: employeeId, employee_name: emp.full_name, week_start: ws, status: 'DRAFT', total_hours: 0, billable_hours: 0, resubmission_count: 0, version: 0, approver_id: emp.manager_id ?? null }, conn);
        await this.history.add(conn, sheet.id, 'CREATED', u.userId);
      }
      await this.db.exec('DELETE FROM timesheet_entries WHERE timesheet_id = ?', [sheet.id], conn);
      for (const e of list) {
        const c = checks.get(`${e.projectId}|${e.workDate}`)!;
        const task = e.taskId ? await this.tasks.findById(e.taskId, conn) : null;
        await this.entries.insert({ timesheet_id: sheet.id, employee_id: employeeId, project_id: e.projectId, project_manager_id: c.projectManagerId, task_id: e.taskId ?? null, task_key: task?.code ?? e.taskKey, work_date: e.workDate, hours: e.hours, billable: e.billable && c.billable ? 1 : 0, description: e.description ?? null }, conn);
      }
      const t = await this.entries.totals(sheet.id, conn);
      await this.sheets.update(sheet.id, { total_hours: t!.total, billable_hours: t!.billable, approver_id: emp.manager_id ?? null }, conn);
      await this.history.add(conn, sheet.id, 'ENTRIES_SAVED', u.userId);
      return sheet.id as string;
    });
    return this.view(await this.sheets.getById(id));
  }

  async deleteEntry(u: AuthUser, entryId: string) {
    const e = await this.entries.getById(entryId, 'Entry'); const sheet = await this.sheets.getById(e.timesheet_id);
    if (sheet.employee_id !== u.employeeId) throw new ForbiddenError();
    if (!['DRAFT', 'REJECTED'].includes(sheet.status)) throw new BusinessRuleError('Only draft or rejected timesheets can be edited');
    await this.db.tx(async (conn) => { await this.entries.remove(entryId, conn); const t = await this.entries.totals(sheet.id, conn); await this.sheets.update(sheet.id, { total_hours: t!.total, billable_hours: t!.billable }, conn); });
    return this.view(await this.sheets.getById(sheet.id));
  }

  async submit(u: AuthUser, id: string) {
    const sheet = await this.sheets.getById(id, 'Timesheet');
    if (sheet.employee_id !== u.employeeId) throw new ForbiddenError('Only the owner can submit a timesheet');
    if (!['DRAFT', 'REJECTED'].includes(sheet.status)) throw new ConflictError(`Timesheet is already ${sheet.status}`);
    if (Number(sheet.total_hours) <= 0) throw new BusinessRuleError('Cannot submit an empty timesheet');
    const resub = sheet.status === 'REJECTED';
    const emp = await this.employees.findById(sheet.employee_id);
    await this.db.tx(async (conn) => {
      await this.sheets.update(sheet.id, { status: 'SUBMITTED', submitted_at: new Date(), approver_id: emp?.manager_id ?? sheet.approver_id, ...(resub ? { resubmission_count: sheet.resubmission_count + 1 } : {}), decided_at: null, decision_comment: null }, conn);
      await this.history.add(conn, id, resub ? 'RESUBMITTED' : 'SUBMITTED', u.userId); await audit(this.db, conn, 'Timesheet', id, resub ? 'RESUBMITTED' : 'SUBMITTED');
      await enqueueOutbox(this.db, conn, Topics.TIMESHEET_SUBMITTED, buildEvent(Topics.TIMESHEET_SUBMITTED, 'timesheet-service', { timesheetId: id, employeeId: sheet.employee_id, employeeName: sheet.employee_name, weekStart: sheet.week_start, totalHours: sheet.total_hours, approverId: emp?.manager_id ?? null }, sheet.employee_id));
    });
    return this.view(await this.sheets.getById(id));
  }

  async decide(u: AuthUser, id: string, approve: boolean, comment?: string) {
    const sheet = await this.sheets.getById(id, 'Timesheet');
    if (sheet.status !== 'SUBMITTED') throw new BusinessRuleError(`Timesheet is ${sheet.status}`);
    if (!(await this.canApprove(u, sheet))) throw new ForbiddenError('You are not an approver for this timesheet');
    await this.db.tx(async (conn) => {
      await this.sheets.update(id, { status: approve ? 'APPROVED' : 'REJECTED', approver_id: u.employeeId ?? sheet.approver_id, decided_at: new Date(), decision_comment: comment ?? null }, conn);
      await this.history.add(conn, id, approve ? 'APPROVED' : 'REJECTED', u.userId, comment); await audit(this.db, conn, 'Timesheet', id, approve ? 'APPROVED' : 'REJECTED', undefined, { comment });
      const topic = approve ? Topics.TIMESHEET_APPROVED : Topics.NOTIFICATION_REQUESTED;
      await enqueueOutbox(this.db, conn, topic, buildEvent(topic, 'timesheet-service', approve
        ? { timesheetId: id, employeeId: sheet.employee_id, weekStart: sheet.week_start, totalHours: sheet.total_hours, approvedBy: u.userId }
        : { type: 'TIMESHEET_REJECTED', recipientEmployeeId: sheet.employee_id, subject: 'Timesheet rejected', body: `Your timesheet for the week of ${sheet.week_start} was rejected: ${comment}`, referenceType: 'Timesheet', referenceId: id }, sheet.employee_id));
    });
    return this.view(await this.sheets.getById(id));
  }

  /** Correction: owner retracts a submitted sheet; the approver can reopen an approved one. */
  async reopen(u: AuthUser, id: string, reason: string) {
    const sheet = await this.sheets.getById(id, 'Timesheet');
    const owner = sheet.employee_id === u.employeeId;
    if (!(sheet.status === 'SUBMITTED' && owner) && !(['SUBMITTED', 'APPROVED'].includes(sheet.status) && (await this.canApprove(u, sheet)))) throw new ForbiddenError('You cannot reopen this timesheet');
    await this.db.tx(async (conn) => { await this.sheets.update(id, { status: 'DRAFT', decided_at: null }, conn); await this.history.add(conn, id, 'REOPENED', u.userId, reason); await audit(this.db, conn, 'Timesheet', id, 'REOPENED', { status: sheet.status }, { reason }); });
    return this.view(await this.sheets.getById(id));
  }

  async get(u: AuthUser, id: string) { const s = await this.sheets.getById(id, 'Timesheet'); await this.assertView(u, s); return this.view(s); }

  async list(u: AuthUser, q: Row) {
    const where: Row = {}; if (q.status) where.status = q.status;
    if (q.from) where.week_start = { op: '>=', value: q.from };
    if (hasPermission(u, 'REPORT_VIEW')) { if (q.employeeId) where.employee_id = q.employeeId; }
    else if (q.employeeId && q.employeeId !== u.employeeId) { const e = await this.employees.findById(q.employeeId); if (e?.manager_id !== u.employeeId) throw new ForbiddenError(); where.employee_id = q.employeeId; }
    else where.employee_id = u.employeeId ?? '-';
    return toDtoPage(await this.sheets.page(where, pageRequest({ sort: 'week_start', ...q })), SHEET_FIELDS);
  }
  async pendingApprovals(u: AuthUser) { return toDtos(await this.sheets.pendingForApprover(u.employeeId ?? '-', u.employeeId ?? '-'), SHEET_FIELDS); }

  // ---------------------------------------------------------------- reports
  /** Work-hour summary of an employee: stored procedure + per-project split fetched concurrently. */
  async employeeSummary(u: AuthUser, employeeId: string, from: string, to: string) {
    if (employeeId !== u.employeeId && !hasPermission(u, 'REPORT_VIEW')) { const e = await this.employees.findById(employeeId); if (e?.manager_id !== u.employeeId) throw new ForbiddenError(); }
    const [proc, byProject] = await Promise.all([this.sheets.employeeSummary(employeeId, from, to), this.sheets.employeeHours(employeeId, from, to)]);
    return { employeeId, from, to, summary: toDtos(proc), byProject: toDtos(byProject) };
  }
  async projectSummary(u: AuthUser, projectId: string, from: string, to: string) {
    if (!hasPermission(u, 'REPORT_VIEW', 'PROJECT_MANAGE')) throw new ForbiddenError();
    const rows = await this.sheets.projectHours(projectId, from, to);
    return { projectId, from, to, totalHours: round2(sum(rows.map((r) => r.total_hours))), billableHours: round2(sum(rows.map((r) => r.billable_hours))), byEmployee: toDtos(rows) };
  }

  // ---------------------------------------------------------------- tasks
  listTasks(projectId: string) { return this.tasks.findAll({ project_id: projectId, active: 1 }, { by: 'code' }).then((r) => toDtos(r)); }
  async createTask(u: AuthUser, projectId: string, dto: Row) {
    if (!hasPermission(u, 'PROJECT_MANAGE')) throw new ForbiddenError();
    if (await this.tasks.findOne({ project_id: projectId, code: dto.code })) throw new ConflictError('Task code already exists for this project');
    return toDto(await this.tasks.insert({ project_id: projectId, code: dto.code, name: dto.name, billable: dto.billable ? 1 : 0, active: dto.active ? 1 : 0 }));
  }
  async updateTask(u: AuthUser, id: string, dto: Row) {
    if (!hasPermission(u, 'PROJECT_MANAGE')) throw new ForbiddenError();
    await this.tasks.getById(id, 'Task');
    await this.tasks.update(id, { name: dto.name, ...(dto.billable !== undefined ? { billable: dto.billable ? 1 : 0 } : {}), ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}) });
    return toDto(await this.tasks.getById(id));
  }
  async upsertEmployee(row: Row, conn: any) { await upsertRow(this.db, 'timesheet_employees', row, conn); }
}
