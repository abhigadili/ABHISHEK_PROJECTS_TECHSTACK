import { Readable, Transform } from 'node:stream';
import {
  AuthUser, Db, ForbiddenError, Row, aggregateInWorker, financialYear, hasPermission, monthRange, round2, settleSections, sum, toDtos, today, addDays, withTimeout, cache, key, groupBy,
} from '@hr/common';
import { reportingConfig } from '../config';
import { DomainClients } from '../clients/reporting.clients';
import { EmployeeReadModel, FactRepository } from '../repositories/reporting.repository';

export class ReportingService {
  private readonly employees: EmployeeReadModel; private readonly facts: FactRepository; private readonly domain = new DomainClients();
  constructor(private readonly db: Db) { this.employees = new EmployeeReadModel(db); this.facts = new FactRepository(db); }

  /** Managers only see their own team; HR/finance/admins see everyone. */
  private async scope(u: AuthUser): Promise<string[] | null> {
    if (hasPermission(u, 'EMPLOYEE_WRITE', 'PAYROLL_VIEW', 'AUDIT_VIEW')) return null;
    if (!u.employeeId) throw new ForbiddenError();
    return this.employees.teamIds(u.employeeId);
  }
  private cached<T>(u: AuthUser, name: string, params: unknown, loader: () => Promise<T>): Promise<T> {
    return cache.getOrLoad(key('rpt', name, u.employeeId ?? u.userId, JSON.stringify(params)), reportingConfig.cacheTtl, loader);
  }

  async headcount(u: AuthUser, q: { from?: string; to?: string; departmentId?: string }) {
    const ids = await this.scope(u); const from = q.from ?? addDays(today(), -365); const to = q.to ?? today();
    return this.cached(u, 'headcount', { q, scoped: !!ids }, async () => {
      const [byDept, moves] = await Promise.all([this.employees.headcountByDepartment(), this.employees.movements(from, to, q.departmentId)]);
      const rows = ids ? [] : byDept.filter((r) => !q.departmentId || r.department_id === q.departmentId);
      const total = sum(rows.filter((r) => ['ACTIVE', 'ON_NOTICE'].includes(r.status)).map((r) => r.employees));
      return { from, to, scope: ids ? 'TEAM' : 'ORGANIZATION', teamSize: ids?.length, activeHeadcount: ids ? ids.length : total, byDepartment: toDtos(rows), joiners: toDtos(moves.joiners), leavers: toDtos(moves.leavers) };
    });
  }

  async leave(u: AuthUser, q: { from?: string; to?: string; departmentId?: string }) {
    const ids = await this.scope(u); const from = q.from ?? `${today().slice(0, 4)}-01-01`; const to = q.to ?? `${today().slice(0, 4)}-12-31`;
    return this.cached(u, 'leave', { q, scoped: !!ids }, async () => {
      const [rows, dept] = await Promise.all([this.facts.leaveRows(from, to), this.employees.byDepartment()]);
      const scoped = rows.filter((r) => (!ids || ids.includes(r.employee_id)) && (!q.departmentId || dept.get(r.employee_id) === q.departmentId));
      const withDept = scoped.map((r) => ({ ...r, department_id: dept.get(r.employee_id) ?? 'UNASSIGNED' }));
      // large inputs are aggregated on a worker thread so the event loop stays responsive
      const [byType, byDepartment] = await Promise.all([aggregateInWorker(withDept, ['category', 'status'], ['num_a']), aggregateInWorker(withDept, ['department_id', 'status'], ['num_a'])]);
      return { from, to, applications: scoped.length, byType: toDtos(byType as Row[]), byDepartment: toDtos(byDepartment as Row[]), utilizationByMonth: ids ? [] : toDtos(await this.facts.utilization()) };
    });
  }

  async attendance(u: AuthUser, month?: string) {
    await this.scope(u); const m = month ?? today().slice(0, 7); const { from, to } = monthRange(m);
    return this.cached(u, 'attendance', m, async () => ({ month: m, from, to, daily: toDtos(await this.facts.attendanceDaily(m)) }));
  }

  /** Payroll comes from the Payroll Service API (it owns the data); only callers with payroll access get numbers. */
  async payroll(u: AuthUser, month?: string) {
    if (!hasPermission(u, 'PAYROLL_VIEW')) throw new ForbiddenError('Payroll reports require payroll access');
    const m = month ?? today().slice(0, 7);
    const runs = await this.domain.payrollRuns(m);
    const detail = await Promise.allSettled(runs.map((r) => this.domain.payrollRunReport(r.id)));
    return { month: m, runs: runs.map((r, i) => ({ id: r.id, status: r.status, employeeCount: r.employeeCount, totalGross: r.totalGross, totalDeductions: r.totalDeductions, totalNet: r.totalNet, report: detail[i].status === 'fulfilled' ? (detail[i] as PromiseFulfilledResult<any>).value : null })) };
  }

  async tax(u: AuthUser, fy?: string) {
    if (!hasPermission(u, 'TAX_REVIEW', 'PAYROLL_VIEW', 'AUDIT_VIEW')) throw new ForbiddenError();
    const f = fy ?? financialYear(today());
    return { financialYear: f, declarations: toDtos(await this.facts.taxByStatus(f)) };
  }

  /** Project allocation report: projects from the Project Service, hours from the Timesheet Service, fetched concurrently. */
  async projectAllocation(u: AuthUser, status?: string) {
    if (!hasPermission(u, 'PROJECT_MANAGE', 'REPORT_VIEW')) throw new ForbiddenError();
    const list = await this.domain.projects(status);
    const detail = await Promise.allSettled(list.content.slice(0, 50).map((p) => withTimeout(this.domain.project_(p.id), 8000, 'project-service')));
    const projects = detail.filter((d): d is PromiseFulfilledResult<any> => d.status === 'fulfilled').map((d) => d.value).map((p) => ({
      id: p.id, code: p.code, name: p.name, status: p.status, team: (p.team ?? []).filter((t: any) => t.status === 'ACTIVE').map((t: any) => ({ employeeId: t.employeeId, name: t.employeeName, role: t.role, allocationPercent: t.allocationPercent, billable: t.billable })),
    }));
    const byEmployee = groupBy(projects.flatMap((p) => p.team.map((t: any) => ({ ...t, projectCode: p.code }))), (t) => t.employeeId as string);
    const loads = [...byEmployee.entries()].map(([employeeId, ts]) => ({ employeeId, name: ts[0].name, totalAllocation: round2(sum(ts.map((t: any) => t.allocationPercent))), projects: ts.map((t: any) => t.projectCode) })).sort((a, b) => b.totalAllocation - a.totalAllocation);
    return { projects, employeeLoad: loads, overAllocated: loads.filter((l) => l.totalAllocation > 100) };
  }

  async timesheets(u: AuthUser, q: { from?: string; to?: string }) {
    await this.scope(u); const from = q.from ?? addDays(today(), -28); const to = q.to ?? today();
    return { from, to, byStatus: toDtos(await this.facts.timesheetByStatus(from, to)) };
  }

  async performance(u: AuthUser, cycleId?: string) {
    if (!hasPermission(u, 'PERFORMANCE_MANAGE', 'REPORT_VIEW')) throw new ForbiddenError();
    const [facts, cycle] = await Promise.allSettled([this.facts.performance(), cycleId ? this.domain.cycleReport(cycleId) : Promise.resolve(null)]);
    return { submissions: facts.status === 'fulfilled' ? toDtos(facts.value) : [], cycle: cycle.status === 'fulfilled' ? cycle.value : null };
  }

  async exits(u: AuthUser, q: { from?: string; to?: string }) {
    await this.scope(u); const from = q.from ?? addDays(today(), -365); const to = q.to ?? addDays(today(), 365);
    const [rows, moves] = await Promise.all([this.facts.exits(from, to), this.employees.movements(from, to)]);
    const byReason = [...groupBy(rows.filter((r) => r.reason), (r) => r.reason as string).entries()].map(([reason, rs]) => ({ reason, exits: rs.length }));
    return { from, to, exits: toDtos(rows), byReason, leaversByMonth: toDtos(moves.leavers) };
  }

  /** Executive summary: every section is computed independently and a failing section never fails the whole report. */
  async summary(u: AuthUser) {
    const { data, unavailable } = await settleSections({
      headcount: () => this.headcount(u, {}), leave: () => this.leave(u, {}), attendance: () => this.attendance(u),
      timesheets: () => this.timesheets(u, {}), exits: () => this.exits(u, {}),
    });
    return { ...data, unavailable };
  }

  // ---------------------------------------------------------------- CSV export (streams)
  /** Async generator -> Readable -> CSV Transform; memory use stays flat for any row count. */
  async exportStream(u: AuthUser, report: 'employees' | 'leave' | 'exits'): Promise<{ stream: Readable; fileName: string }> {
    if (!hasPermission(u, 'EMPLOYEE_WRITE', 'AUDIT_VIEW', 'REPORT_VIEW')) throw new ForbiddenError();
    const ids = await this.scope(u);
    let source: AsyncGenerator<Row>;
    if (report === 'employees') source = this.employees.stream();
    else if (report === 'leave') source = (async function* (rows: Row[]) { yield* rows; })(await this.facts.leaveRows('2000-01-01', '2100-01-01'));
    else source = (async function* (rows: Row[]) { yield* rows; })(await this.facts.exits('2000-01-01', '2100-01-01'));
    const filtered = (async function* () { for await (const r of source) if (!ids || !r.employee_id || ids.includes(r.employee_id)) yield r; })();
    const csv = new Transform({
      writableObjectMode: true, readableObjectMode: false,
      transform(row: Row, _enc, cb) {
        if (!(this as any).header) { (this as any).header = Object.keys(row); this.push(`${(this as any).header.join(',')}\n`); }
        this.push(`${(this as any).header.map((h: string) => escapeCsv(row[h])).join(',')}\n`); cb();
      },
    });
    return { stream: Readable.from(filtered).pipe(csv), fileName: `${report}-${today()}.csv` };
  }
}
/** CSV-injection safe: cells starting with = + - @ are prefixed with a quote. */
function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
