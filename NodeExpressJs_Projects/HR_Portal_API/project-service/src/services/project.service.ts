import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, NotFoundError, Row, ValidationError, audit, hasPermission, pageRequest, toColumns, toDto, toDtoPage, toDtos, today,
} from '@hr/common';
import { EmployeeClient } from '../clients/employee.client';
import { AllocationRepository, CustomerRepository, ProjectHistoryRepository, ProjectRepository } from '../repositories/project.repository';

const TRANSITIONS: Record<string, string[]> = { PLANNED: ['ACTIVE', 'CANCELLED'], ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'], ON_HOLD: ['ACTIVE', 'CANCELLED', 'COMPLETED'], COMPLETED: [], CANCELLED: [] };
const BILLING_FIELDS = ['billingModel', 'billingRate', 'billingContactId', 'billingNotes', 'budget', 'currency'];
const BASE_FIELDS = ['id', 'code', 'name', 'description', 'customerId', 'projectManagerId', 'startDate', 'endDate', 'status', 'version', 'createdAt', 'updatedAt'];

export class ProjectService {
  readonly projects: ProjectRepository; readonly allocations: AllocationRepository; private readonly history: ProjectHistoryRepository; private readonly customers: CustomerRepository;
  private readonly employees = new EmployeeClient();
  constructor(private readonly db: Db) { this.projects = new ProjectRepository(db); this.allocations = new AllocationRepository(db); this.history = new ProjectHistoryRepository(db); this.customers = new CustomerRepository(db); }

  private canManage(u: AuthUser, p: Row): boolean { return hasPermission(u, 'PROJECT_MANAGE') && (p.project_manager_id === u.employeeId || u.roles.includes('SUPER_ADMIN')); }
  private seesBilling(u: AuthUser, p: Row): boolean { return hasPermission(u, 'PAYROLL_VIEW') || this.canManage(u, p); }
  private view(u: AuthUser, p: Row): Row { return toDto(p, [...BASE_FIELDS, ...(this.seesBilling(u, p) ? BILLING_FIELDS : [])]); }

  async create(dto: Row, actor: AuthUser) {
    if (await this.projects.findOne({ code: dto.code })) throw new ConflictError('Project code already exists');
    await this.customers.getById(dto.customerId, 'Customer');
    const pm = await this.employees.summary(dto.projectManagerId).catch(() => null);
    if (!pm) throw new ValidationError('Project manager is not a valid employee');
    if (!['ACTIVE', 'ON_NOTICE'].includes(pm.status)) throw new ValidationError('Project manager must be an active employee');
    const p = await this.db.tx(async (conn) => {
      const row = await this.projects.insert({ ...toColumns(dto), status: dto.startDate <= today() ? 'ACTIVE' : 'PLANNED', version: 0 }, conn);
      await this.history.add(conn, row.id, 'CREATED', null, row.status); await audit(this.db, conn, 'Project', row.id, 'CREATED', undefined, { code: dto.code });
      return row;
    });
    return this.view(actor, p);
  }

  async list(u: AuthUser, q: Row) {
    const where: Row = {}; if (q.status) where.status = q.status; if (q.customerId) where.customer_id = q.customerId; if (q.projectManagerId) where.project_manager_id = q.projectManagerId;
    if (!hasPermission(u, 'PROJECT_MANAGE', 'REPORT_VIEW', 'PAYROLL_VIEW')) where.id = u.employeeId ? await this.projects.accessibleIds(u.employeeId) : [];
    const page = await this.projects.page(where, pageRequest(q), q.q);
    return { ...page, content: page.content.map((p) => this.view(u, p)) };
  }

  async get(id: string, u: AuthUser) {
    const p = await this.projects.getById(id, 'Project');
    const team = await this.allocations.team(id);
    const allowed = hasPermission(u, 'PROJECT_MANAGE', 'REPORT_VIEW', 'PAYROLL_VIEW') || team.some((t) => t.employee_id === u.employeeId);
    if (!allowed) throw new ForbiddenError('You are not part of this project');
    return { ...this.view(u, p), team: toDtos(team) };
  }

  async update(id: string, dto: Row, u: AuthUser) {
    const p = await this.projects.getById(id, 'Project');
    if (!this.canManage(u, p)) throw new ForbiddenError('Only the project manager can edit this project');
    if (dto.version !== p.version) throw new ConflictError('The project was modified by someone else; reload and retry');
    if (['COMPLETED', 'CANCELLED'].includes(p.status)) throw new BusinessRuleError(`A ${p.status} project cannot be edited`);
    const { version: _v, ...rest } = dto;
    const start = rest.startDate ?? p.start_date; const end = rest.endDate ?? p.end_date;
    if (end && end < start) throw new ValidationError('endDate must not precede startDate');
    if (rest.code && rest.code !== p.code && (await this.projects.findOne({ code: rest.code }))) throw new ConflictError('Project code already exists');
    if (rest.projectManagerId && !u.roles.includes('SUPER_ADMIN') && rest.projectManagerId !== p.project_manager_id) throw new ForbiddenError('Only an administrator can reassign the project manager');
    const patch = toColumns(rest);
    await this.db.tx(async (conn) => {
      const n = await this.projects.update({ id, version: p.version }, patch, conn);
      if (!n) throw new ConflictError('The project was modified by someone else; reload and retry');
      for (const [k, v] of Object.entries(patch)) if (String(v ?? '') !== String(p[k] ?? '')) await this.history.add(conn, id, k.toUpperCase(), p[k], v);
      await audit(this.db, conn, 'Project', id, 'UPDATED', undefined, patch);
    });
    return this.view(u, await this.projects.getById(id));
  }

  async changeStatus(id: string, status: string, reason: string | undefined, u: AuthUser) {
    const p = await this.projects.getById(id, 'Project');
    if (!this.canManage(u, p)) throw new ForbiddenError('Only the project manager can change the status');
    if (!TRANSITIONS[p.status]?.includes(status)) throw new BusinessRuleError(`Cannot move a ${p.status} project to ${status}`);
    await this.db.tx(async (conn) => {
      await this.projects.update(id, { status, ...(status === 'COMPLETED' && !p.end_date ? { end_date: today() } : {}) }, conn);
      if (['COMPLETED', 'CANCELLED'].includes(status)) await this.db.exec("UPDATE project_allocations SET status = 'ENDED', end_date = LEAST(COALESCE(end_date, ?), ?), updated_at = ? WHERE project_id = ? AND status = 'ACTIVE'", [today(), today(), new Date(), id], conn);
      await this.history.add(conn, id, 'STATUS', p.status, status); await audit(this.db, conn, 'Project', id, 'STATUS_CHANGED', { status: p.status }, { status, reason });
    });
    return this.view(u, await this.projects.getById(id));
  }

  async remove(id: string, u: AuthUser) {
    const p = await this.projects.getById(id, 'Project');
    if (!this.canManage(u, p)) throw new ForbiddenError();
    if (p.status === 'ACTIVE') throw new BusinessRuleError('Active projects cannot be deleted');
    await this.projects.remove(id); await audit(this.db, undefined, 'Project', id, 'DELETED');
  }

  historyOf(id: string) { return this.history.findAll({ project_id: id }, { by: 'created_at', dir: 'DESC' }).then((r) => toDtos(r)); }

  // ---------------------------------------------------------------- allocations
  async allocate(projectId: string, dto: Row, u: AuthUser) {
    const p = await this.projects.getById(projectId, 'Project');
    if (!this.canManage(u, p)) throw new ForbiddenError('Only the project manager can allocate people');
    if (!['PLANNED', 'ACTIVE'].includes(p.status)) throw new BusinessRuleError(`Cannot allocate people to a ${p.status} project`);
    if (dto.startDate < p.start_date || (p.end_date && (dto.startDate > p.end_date || (dto.endDate && dto.endDate > p.end_date)))) throw new BusinessRuleError('Allocation dates must fall within the project dates');
    const emp = await this.employees.summary(dto.employeeId).catch(() => null);
    if (!emp) throw new ValidationError('Employee does not exist');
    if (!['ACTIVE', 'ON_NOTICE'].includes(emp.status)) throw new BusinessRuleError('Only active employees can be allocated');
    if (await this.db.one("SELECT id FROM project_allocations WHERE project_id = ? AND employee_id = ? AND status = 'ACTIVE' AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)", [projectId, dto.employeeId, dto.endDate ?? '9999-12-31', dto.startDate])) throw new ConflictError('Employee is already allocated to this project in that period');
    const alloc = await this.db.tx(async (conn) => {
      const committed = await this.allocations.committed(dto.employeeId, dto.startDate, dto.endDate ?? null, undefined, conn);
      if (committed + dto.allocationPercent > 100) throw new BusinessRuleError(`Employee is already ${committed}% allocated; adding ${dto.allocationPercent}% would exceed 100%`);
      const a = await this.allocations.insert({ project_id: projectId, employee_id: dto.employeeId, employee_name: emp.fullName, role: dto.role, allocation_percent: dto.allocationPercent, billable: dto.billable ? 1 : 0, start_date: dto.startDate, end_date: dto.endDate ?? null, status: 'ACTIVE' }, conn);
      await this.history.add(conn, projectId, 'ALLOCATION_ADDED', null, `${emp.fullName} ${dto.allocationPercent}%`); await audit(this.db, conn, 'ProjectAllocation', a.id, 'CREATED', undefined, { projectId, employeeId: dto.employeeId, percent: dto.allocationPercent });
      return a;
    });
    return toDto(alloc);
  }

  async updateAllocation(projectId: string, allocId: string, dto: Row, u: AuthUser) {
    const p = await this.projects.getById(projectId, 'Project'); if (!this.canManage(u, p)) throw new ForbiddenError();
    const a = await this.allocations.findOne({ id: allocId, project_id: projectId }); if (!a) throw new NotFoundError('Allocation', allocId);
    if (a.status !== 'ACTIVE') throw new BusinessRuleError('Ended allocations cannot be changed');
    await this.db.tx(async (conn) => {
      const pct = dto.allocationPercent ?? Number(a.allocation_percent); const end = dto.endDate === undefined ? a.end_date : dto.endDate;
      if (end && end < a.start_date) throw new ValidationError('endDate must not precede startDate');
      const committed = await this.allocations.committed(a.employee_id, a.start_date, end ?? null, allocId, conn);
      if (committed + pct > 100) throw new BusinessRuleError(`Employee would be ${committed + pct}% allocated (max 100%)`);
      await this.allocations.update(allocId, { role: dto.role, allocation_percent: dto.allocationPercent, ...(dto.billable !== undefined ? { billable: dto.billable ? 1 : 0 } : {}), ...(dto.endDate !== undefined ? { end_date: dto.endDate } : {}) }, conn);
      await this.history.add(conn, projectId, 'ALLOCATION_CHANGED', `${a.employee_name} ${a.allocation_percent}%`, `${pct}%`); await audit(this.db, conn, 'ProjectAllocation', allocId, 'UPDATED', undefined, dto);
    });
    return toDto(await this.allocations.getById(allocId));
  }

  async endAllocation(projectId: string, allocId: string, endDate: string | undefined, u: AuthUser) {
    const p = await this.projects.getById(projectId, 'Project'); if (!this.canManage(u, p)) throw new ForbiddenError();
    const a = await this.allocations.findOne({ id: allocId, project_id: projectId }); if (!a) throw new NotFoundError('Allocation', allocId);
    if (a.status !== 'ACTIVE') throw new BusinessRuleError('Allocation is already ended');
    const end = endDate ?? today(); if (end < a.start_date) throw new ValidationError('endDate must not precede startDate');
    await this.db.tx(async (conn) => { await this.allocations.update(allocId, { status: 'ENDED', end_date: end }, conn); await this.history.add(conn, projectId, 'ALLOCATION_ENDED', a.employee_name, end); await audit(this.db, conn, 'ProjectAllocation', allocId, 'ENDED'); });
    return toDto(await this.allocations.getById(allocId));
  }

  /** Used by the Timesheet Service to validate that an employee may log time on a project on a date. */
  async allocationCheck(projectId: string, employeeId: string, date: string) {
    const p = await this.projects.getById(projectId, 'Project');
    const a = await this.allocations.coveringOn(projectId, employeeId, date);
    return { projectId, projectCode: p.code, projectStatus: p.status, projectManagerId: p.project_manager_id, employeeId, date, allocated: !!a && ['ACTIVE'].includes(p.status), allocationPercent: a ? Number(a.allocation_percent) : 0, billable: a ? !!a.billable : false };
  }

  async employeeProjects(employeeId: string, u: AuthUser) {
    if (employeeId !== u.employeeId && !hasPermission(u, 'PROJECT_MANAGE', 'REPORT_VIEW')) throw new ForbiddenError();
    return toDtos(await this.projects.forEmployee(employeeId));
  }
  /** Existing stored procedure: allocation summary of an employee on a date. */
  async allocationSummary(employeeId: string, date: string | undefined, u: AuthUser) {
    if (employeeId !== u.employeeId && !hasPermission(u, 'PROJECT_MANAGE', 'REPORT_VIEW')) throw new ForbiddenError();
    return toDtos(await this.allocations.summary(employeeId, date ?? today()));
  }
}
