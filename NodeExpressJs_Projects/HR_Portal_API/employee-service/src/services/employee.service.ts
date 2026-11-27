import crypto from 'node:crypto';
import {
  AuthUser, BusinessRuleError, displayField, encryptField, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, ConflictError, audit, buildEvent, cache, employeeSnapshot,
  enqueueOutbox, hasPermission, key, mask, requestContext, toColumns, toDto, toDtos, today, round2,
} from '@hr/common';
import { OrganizationClient } from '../clients/organization.client';
import { employeeConfig } from '../config';
import { DIRECTORY_FIELDS, PROFILE_FIELDS, SENSITIVE_PROFILE_FIELDS, SUB_RESOURCES, SubResource } from '../dto/employee.dto';
import { EmployeeRepository, HistoryRepository, SubResourceRepository } from '../repositories/employee.repository';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['ON_NOTICE', 'INACTIVE', 'TERMINATED', 'RESIGNED'],
  ON_NOTICE: ['ACTIVE', 'RESIGNED', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'TERMINATED'],
  RESIGNED: ['ACTIVE'],
  TERMINATED: [],
};
const TRACKED = ['first_name', 'middle_name', 'last_name', 'work_email', 'personal_email', 'phone', 'alternate_phone', 'date_of_birth', 'gender', 'marital_status', 'blood_group',
  'nationality', 'national_id', 'pan_number', 'department_id', 'designation_id', 'job_grade_id', 'location_id', 'manager_id', 'employment_type', 'confirmation_date', 'notice_period_days'];
const SENSITIVE_TRACKED = new Set(['national_id', 'pan_number']);

export class EmployeeService {
  private readonly employees: EmployeeRepository;
  private readonly history: HistoryRepository;
  private readonly org = new OrganizationClient();

  constructor(private readonly db: Db) {
    this.employees = new EmployeeRepository(db);
    this.history = new HistoryRepository(db);
  }

  // ----------------------------------------------------------------- access rules
  private isHr(u: AuthUser): boolean { return hasPermission(u, 'EMPLOYEE_READ', 'EMPLOYEE_WRITE'); }
  private canView(u: AuthUser, emp: Row): boolean {
    return this.isHr(u) || (!!u.employeeId && (u.employeeId === emp.id || u.employeeId === emp.manager_id));
  }
  private assertCanEditSub(u: AuthUser, employeeId: string): void {
    if (!(hasPermission(u, 'EMPLOYEE_WRITE') || (u.employeeId === employeeId))) throw new ForbiddenError('You may only edit your own records');
  }

  // ----------------------------------------------------------------- onboarding
  private async validateOrgRefs(dto: { departmentId?: string; designationId?: string; locationId?: string }): Promise<void> {
    // concurrent synchronous calls to the Organization Service (Promise.all)
    const [dep, des, loc] = await Promise.all([
      dto.departmentId ? this.org.department(dto.departmentId) : Promise.resolve(true),
      dto.designationId ? this.org.designation(dto.designationId) : Promise.resolve(true),
      dto.locationId ? this.org.location(dto.locationId) : Promise.resolve(true),
    ]);
    const bad = [!dep && 'departmentId', !des && 'designationId', !loc && 'locationId'].filter(Boolean);
    if (bad.length) throw new ValidationError('Unknown organization reference', bad);
  }

  async onboard(dto: Row) {
    await this.validateOrgRefs(dto);
    if (await this.employees.findOne({ work_email: dto.workEmail })) throw new ConflictError('Work email is already in use');
    if (dto.managerId) await this.employees.getById(dto.managerId, 'Manager');
    const cols = toColumns(dto, ['firstName', 'middleName', 'lastName', 'workEmail', 'personalEmail', 'phone', 'alternatePhone', 'dateOfBirth', 'gender', 'maritalStatus', 'bloodGroup',
      'nationality', 'nationalId', 'panNumber', 'departmentId', 'designationId', 'locationId', 'jobGradeId', 'managerId', 'employmentType', 'joiningDate', 'confirmationDate', 'noticePeriodDays']);
    this.protect(cols);
    const emp = await this.db.tx(async (conn) => {
      const code = await this.employees.nextCode(conn);
      const row = await this.employees.insert({ ...cols, employee_code: code, status: 'ACTIVE', version: 0 }, conn);
      await this.history.addEmployment(conn, { employeeId: row.id, type: 'JOINED', effective: dto.joiningDate, to: code });
      await audit(this.db, conn, 'Employee', row.id, 'ONBOARDED', undefined, { employeeCode: code, departmentId: dto.departmentId });
      await enqueueOutbox(this.db, conn, Topics.EMPLOYEE_CREATED, buildEvent(Topics.EMPLOYEE_CREATED, 'employee-service', employeeSnapshot(row), row.id));
      return row;
    });
    await this.evict();
    return this.profile(emp.id, requestContext.user()!);
  }

  // ----------------------------------------------------------------- reads
  async directory(q: Record<string, any>) {
    const k = key('emp', 'dir', crypto.createHash('md5').update(JSON.stringify(q)).digest('hex'));
    return cache.getOrLoad(k, employeeConfig.directoryTtl, async () => {
      const page = Number(q.page ?? 0); const size = Number(q.size ?? 20);
      const [total, rows] = await this.employees.directory(q, page, size, String(q.sort ?? '').split(',')[0], String(q.sort ?? '').endsWith(',desc') ? 'DESC' : 'ASC');
      return { content: toDtos(rows, DIRECTORY_FIELDS), page, size, totalElements: Number(total), totalPages: Math.ceil(Number(total) / size) };
    });
  }

  /** Profile + organization names fetched concurrently; sensitive identifiers masked for non-HR viewers. */
  async profile(id: string, viewer: AuthUser) {
    const emp = await this.employees.getById(id, 'Employee');
    if (!this.canView(viewer, emp)) throw new ForbiddenError('You are not allowed to view this profile');
    const hr = hasPermission(viewer, 'EMPLOYEE_WRITE'); // only HR sees national id / PAN unmasked
    const [dep, des, loc, manager, tenure] = await Promise.allSettled([
      emp.department_id ? this.org.department(emp.department_id) : null,
      emp.designation_id ? this.org.designation(emp.designation_id) : null,
      emp.location_id ? this.org.location(emp.location_id) : null,
      emp.manager_id ? this.employees.findById(emp.manager_id) : null,
      this.employees.tenureMonths(emp.joining_date),
    ]);
    const val = <T>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
    const m = val(manager) as Row | null;
    const dto: Row = toDto(emp, [...PROFILE_FIELDS, ...(hr || viewer.employeeId === id ? SENSITIVE_PROFILE_FIELDS : [])]);
    if (hr || viewer.employeeId === id) { dto.nationalId = displayField(emp.national_id, hr); dto.panNumber = displayField(emp.pan_number, hr); }
    return {
      ...dto,
      fullName: [emp.first_name, emp.last_name].join(' '),
      tenureMonths: val(tenure),
      department: val(dep), designation: val(des), location: val(loc),
      manager: m ? { id: m.id, fullName: `${m.first_name} ${m.last_name}`, employeeCode: m.employee_code } : null,
    };
  }

  async team(managerId: string) {
    const rows = await this.employees.findAll({ manager_id: managerId, status: ['ACTIVE', 'ON_NOTICE'] }, { by: 'first_name' });
    return rows.map((r) => ({ employeeId: r.id, employeeCode: r.employee_code, fullName: `${r.first_name} ${r.last_name}`, workEmail: r.work_email, status: r.status, designationId: r.designation_id }));
  }

  /** Lightweight lookup used by other services (leave, payroll, exit, timesheet...). */
  async summary(id: string) {
    const e = await this.employees.getById(id, 'Employee');
    return { ...employeeSnapshot(e), noticePeriodDays: e.notice_period_days, employmentType: e.employment_type };
  }

  // ----------------------------------------------------------------- updates
  async update(id: string, dto: Row, actor: AuthUser) {
    const before = await this.employees.getById(id, 'Employee');
    const isSelf = actor.employeeId === id;
    if (!hasPermission(actor, 'EMPLOYEE_WRITE')) {
      if (!isSelf) throw new ForbiddenError('Only HR may edit another employee');
      const selfEditable = new Set(['personalEmail', 'phone', 'alternatePhone', 'maritalStatus', 'bloodGroup']);
      const bad = Object.keys(dto).filter((k) => k !== 'version' && !selfEditable.has(k));
      if (bad.length) throw new ForbiddenError(`You may not edit: ${bad.join(', ')}`);
    }
    if (dto.version !== before.version) throw new ConflictError('The employee was modified by someone else; reload and retry');
    await this.validateOrgRefs(dto);
    if (dto.workEmail && dto.workEmail !== before.work_email && (await this.employees.findOne({ work_email: dto.workEmail }))) throw new ConflictError('Work email is already in use');
    if (dto.managerId) {
      if (dto.managerId === id) throw new BusinessRuleError('An employee cannot be their own manager');
      await this.assertNoCycle(id, dto.managerId);
    }
    const { version: _v, ...rest } = dto;
    const patch = toColumns(rest);
    this.protect(patch);
    const changed = TRACKED.filter((c) => c in patch && String(patch[c] ?? '') !== String(before[c] ?? ''));
    if (!changed.length) return this.profile(id, actor);
    await this.db.tx(async (conn) => {
      const n = await this.employees.update({ id, version: before.version }, patch, conn);
      if (!n) throw new ConflictError('The employee was modified by someone else; reload and retry');
      for (const c of changed) await this.history.addProfileChange(conn, id, c, SENSITIVE_TRACKED.has(c) ? '[MASKED]' : before[c], SENSITIVE_TRACKED.has(c) ? '[MASKED]' : patch[c]);
      const eff = today();
      if (changed.includes('department_id') || changed.includes('location_id')) await this.history.addEmployment(conn, { employeeId: id, type: 'TRANSFER', from: before.department_id, to: patch.department_id ?? before.department_id, effective: eff });
      if (changed.includes('designation_id')) await this.history.addEmployment(conn, { employeeId: id, type: 'PROMOTION', from: before.designation_id, to: patch.designation_id, effective: eff });
      if (changed.includes('manager_id')) await this.history.addEmployment(conn, { employeeId: id, type: 'MANAGER_CHANGE', from: before.manager_id, to: patch.manager_id, effective: eff });
      const after = { ...before, ...patch };
      await audit(this.db, conn, 'Employee', id, 'PROFILE_UPDATED', Object.fromEntries(changed.map((c) => [c, before[c]])), Object.fromEntries(changed.map((c) => [c, patch[c]])));
      await enqueueOutbox(this.db, conn, Topics.EMPLOYEE_UPDATED, buildEvent(Topics.EMPLOYEE_UPDATED, 'employee-service', employeeSnapshot(after), id));
    });
    await this.evict();
    return this.profile(id, actor);
  }

  private async assertNoCycle(id: string, newManagerId: string): Promise<void> {
    const rows = await this.db.query<Row>(
      `WITH RECURSIVE chain AS (SELECT id, manager_id, 1 AS depth FROM employees WHERE id = ?
         UNION ALL SELECT e.id, e.manager_id, c.depth + 1 FROM employees e JOIN chain c ON e.id = c.manager_id WHERE c.depth < 50)
       SELECT id FROM chain WHERE id = ?`, [newManagerId, id]);
    if (rows.length) throw new BusinessRuleError('Manager assignment would create a reporting cycle');
  }

  async changeStatus(id: string, status: string, reason: string | undefined, exitDate: string | undefined) {
    const before = await this.employees.getById(id, 'Employee');
    if (before.status === status) return this.summary(id);
    if (!ALLOWED_TRANSITIONS[before.status]?.includes(status)) throw new BusinessRuleError(`Cannot change status from ${before.status} to ${status}`);
    if ((status === 'TERMINATED' || status === 'RESIGNED') && !(exitDate ?? before.exit_date)) throw new ValidationError('exitDate is required for this status');
    const topic = status === 'TERMINATED' ? Topics.EMPLOYEE_TERMINATED : status === 'RESIGNED' ? Topics.EMPLOYEE_EXITED : Topics.EMPLOYEE_UPDATED;
    await this.db.tx(async (conn) => {
      await this.employees.update(id, { status, ...(exitDate ? { exit_date: exitDate } : {}), ...(status === 'ACTIVE' ? { exit_date: null } : {}) }, conn); // status history written by DB trigger
      await this.history.addEmployment(conn, { employeeId: id, type: 'STATUS_CHANGE', from: before.status, to: status, reason, effective: exitDate ?? today() });
      await audit(this.db, conn, 'Employee', id, 'STATUS_CHANGED', { status: before.status }, { status, reason });
      const after = { ...before, status, exit_date: exitDate ?? before.exit_date };
      await enqueueOutbox(this.db, conn, topic, buildEvent(topic, 'employee-service', employeeSnapshot(after), id));
    });
    await this.evict();
    return this.summary(id);
  }

  /** Consumer path: exit-service finished the offboarding => mark RESIGNED (idempotent, no outbox loop). */
  async applyExit(employeeId: string, exitDate: string | null, conn: any): Promise<void> {
    const e = await this.employees.findById(employeeId, conn);
    if (!e || ['RESIGNED', 'TERMINATED'].includes(e.status)) return;
    await this.employees.update(employeeId, { status: 'RESIGNED', exit_date: exitDate ?? today() }, conn);
    await this.history.addEmployment(conn, { employeeId, type: 'STATUS_CHANGE', from: e.status, to: 'RESIGNED', effective: exitDate ?? today(), reason: 'Exit workflow completed' });
    await audit(this.db, conn, 'Employee', employeeId, 'EXITED', { status: e.status }, { status: 'RESIGNED' });
    // publish the authoritative snapshot so every read model learns the new status / exit date
    await enqueueOutbox(this.db, conn, Topics.EMPLOYEE_EXITED, buildEvent(Topics.EMPLOYEE_EXITED, 'employee-service', employeeSnapshot({ ...e, status: 'RESIGNED', exit_date: exitDate ?? today() }), employeeId));
    await this.evict();
  }

  async applyNotice(employeeId: string, conn: any): Promise<void> {
    const e = await this.employees.findById(employeeId, conn);
    if (!e || e.status !== 'ACTIVE') return;
    await this.employees.update(employeeId, { status: 'ON_NOTICE' }, conn);
    await enqueueOutbox(this.db, conn, Topics.EMPLOYEE_UPDATED, buildEvent(Topics.EMPLOYEE_UPDATED, 'employee-service', employeeSnapshot({ ...e, status: 'ON_NOTICE' }), employeeId));
    await this.evict();
  }

  /** Resignation withdrawn: back from ON_NOTICE to ACTIVE. */
  async revertNotice(employeeId: string, conn: any): Promise<void> {
    const e = await this.employees.findById(employeeId, conn);
    if (!e || e.status !== 'ON_NOTICE') return;
    await this.employees.update(employeeId, { status: 'ACTIVE' }, conn);
    await enqueueOutbox(this.db, conn, Topics.EMPLOYEE_UPDATED, buildEvent(Topics.EMPLOYEE_UPDATED, 'employee-service', employeeSnapshot({ ...e, status: 'ACTIVE' }), employeeId));
    await this.evict();
  }

  async remove(id: string) {
    const e = await this.employees.getById(id, 'Employee');
    if (e.status === 'ACTIVE') throw new BusinessRuleError('Active employees cannot be deleted; change their status first');
    await this.employees.remove(id);
    await audit(this.db, undefined, 'Employee', id, 'DELETED');
    await this.evict();
  }

  // ----------------------------------------------------------------- sub resources
  async listSub(employeeId: string, kind: SubResource, viewer: AuthUser) {
    const emp = await this.employees.getById(employeeId, 'Employee');
    const isBank = kind === 'bank-details';
    if (isBank ? !(viewer.employeeId === employeeId || hasPermission(viewer, 'EMPLOYEE_WRITE', 'PAYROLL_VIEW')) : !this.canView(viewer, emp)) throw new ForbiddenError();
    const rows = await new SubResourceRepository(this.db, SUB_RESOURCES[kind].table).forEmployee(employeeId);
    return rows.map((r) => (isBank ? { ...toDto(r), accountNumber: displayField(r.account_number), ifscCode: displayField(r.ifsc_code, true) } : toDto(r)));
  }

  async addSub(employeeId: string, kind: SubResource, dto: any, actor: AuthUser) {
    this.assertCanEditSub(actor, employeeId);
    await this.employees.getById(employeeId, 'Employee');
    const def = SUB_RESOURCES[kind];
    const row = await this.db.tx(async (conn) => {
      const repo = new SubResourceRepository(this.db, def.table);
      const r = await repo.insert({ ...this.protectBank(kind, def.map(dto)), employee_id: employeeId }, conn);
      await audit(this.db, conn, 'Employee', employeeId, `${kind.toUpperCase()}_ADDED`, undefined, kind === 'bank-details' ? { id: r.id } : def.map(dto));
      return r;
    });
    await this.evict();
    return kind === 'bank-details' ? { ...toDto(row), accountNumber: displayField(row.account_number) } : toDto(row);
  }

  async updateSub(employeeId: string, kind: SubResource, subId: string, dto: any, actor: AuthUser) {
    this.assertCanEditSub(actor, employeeId);
    const repo = new SubResourceRepository(this.db, SUB_RESOURCES[kind].table);
    const existing = await repo.findOne({ id: subId, employee_id: employeeId });
    if (!existing) throw new NotFoundError(kind, subId);
    await repo.update(subId, this.protectBank(kind, SUB_RESOURCES[kind].map(dto)));
    await audit(this.db, undefined, 'Employee', employeeId, `${kind.toUpperCase()}_UPDATED`, undefined, { id: subId });
    const row = (await repo.findById(subId))!;
    return kind === 'bank-details' ? { ...toDto(row), accountNumber: displayField(row.account_number) } : toDto(row);
  }

  async deleteSub(employeeId: string, kind: SubResource, subId: string, actor: AuthUser) {
    this.assertCanEditSub(actor, employeeId);
    const repo = new SubResourceRepository(this.db, SUB_RESOURCES[kind].table);
    if (!(await repo.findOne({ id: subId, employee_id: employeeId }))) throw new NotFoundError(kind, subId);
    await repo.remove(subId);
    await audit(this.db, undefined, 'Employee', employeeId, `${kind.toUpperCase()}_REMOVED`, { id: subId });
  }

  // ----------------------------------------------------------------- history
  async employmentHistory(id: string, viewer: AuthUser) { const e = await this.employees.getById(id, 'Employee'); if (!this.canView(viewer, e)) throw new ForbiddenError(); return toDtos(await this.history.employment(id)); }
  async profileChanges(id: string) { await this.employees.getById(id, 'Employee'); return toDtos(await this.history.profileChanges(id)); }
  async statusHistory(id: string) { await this.employees.getById(id, 'Employee'); return toDtos(await this.history.statusHistory(id)); }

  async headcountByDepartment() {
    const rows = await this.db.query<Row>("SELECT department_id, status, COUNT(*) AS employees FROM employees WHERE deleted = 0 GROUP BY department_id, status");
    return toDtos(rows);
  }

  /** PAN / national id are stored encrypted; changes are logged masked (see TRACKED handling). */
  private protect(cols: Row): void {
    for (const c of ['pan_number', 'national_id']) if (cols[c] !== undefined) cols[c] = encryptField(cols[c]);
  }
  private protectBank(kind: string, row: Row): Row {
    if (kind !== 'bank-details') return row;
    return { ...row, account_number: encryptField(row.account_number), ...(row.ifsc_code ? { ifsc_code: encryptField(row.ifsc_code) } : {}) };
  }

  private async evict(): Promise<void> { await cache.evictPrefix(key('emp')); }
}
void round2;
