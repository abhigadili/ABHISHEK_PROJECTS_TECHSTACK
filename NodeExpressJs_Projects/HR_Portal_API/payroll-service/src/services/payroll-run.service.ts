import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, Row, Topics, ValidationError, aggregateInWorker, audit, buildEvent, enqueueOutbox, logger, monthRange, pageRequest,
  requestContext, round2, toDto, toDtoPage, toDtos, withLock, Page, upsertRow,
} from '@hr/common';
import { AttendanceClient, DirectoryEntry, EmployeeClient, LeaveClient, TaxClient } from '../clients/payroll.clients';
import { payrollConfig } from '../config';
import { AdjustmentRepository, EntryRepository, LoanRepository, RunRepository, SalaryRepository, StructureRepository } from '../repositories/payroll.repository';
import { Line, calculateSalary, parseSettings, totals } from './salary-engine';
import { SalaryService } from './salary.service';
import { PayslipService } from './payslip.service';

interface EmployeePlan { emp: DirectoryEntry; salary: Row; lines: Line[]; attendance: { workingDays: number; paidDays: number; lopDays: number; overtimeMinutes: number }; loans: { loanId: string; amount: number }[]; adjustmentIds: string[] }

export class PayrollRunService {
  private readonly runs: RunRepository; private readonly entries: EntryRepository; private readonly salaries: SalaryRepository; private readonly structures: StructureRepository;
  private readonly adjustments: AdjustmentRepository; private readonly loans: LoanRepository;
  private readonly employees = new EmployeeClient(); private readonly attendance = new AttendanceClient(); private readonly leave = new LeaveClient(); private readonly tax = new TaxClient();

  constructor(private readonly db: Db, private readonly salary: SalaryService, private readonly payslips: PayslipService) {
    this.runs = new RunRepository(db); this.entries = new EntryRepository(db); this.salaries = new SalaryRepository(db); this.structures = new StructureRepository(db);
    this.adjustments = new AdjustmentRepository(db); this.loans = new LoanRepository(db);
  }

  async create(month: string, note?: string) {
    if (await this.runs.findOne({ payroll_month: month })) throw new ConflictError(`A payroll run for ${month} already exists`);
    const r = await this.runs.insert({ payroll_month: month, status: 'DRAFT', note: note ?? null, employee_count: 0, total_gross: 0, total_deductions: 0, total_net: 0, version: 0 });
    await audit(this.db, undefined, 'PayrollRun', r.id, 'CREATED', undefined, { month });
    return toDto(r);
  }
  list(q: Row): Promise<Page<Row>> { return this.runs.page(q.status ? { status: q.status } : {}, pageRequest({ sort: 'payroll_month', ...q })).then((p) => toDtoPage(p)); }

  async get(id: string) {
    const run = await this.runs.getById(id, 'Payroll run');
    const byDept = await this.entries.byDepartment(id);
    return { ...toDto(run), byDepartment: toDtos(byDept) };
  }

  async listEntries(runId: string, q: Row) {
    await this.runs.getById(runId, 'Payroll run');
    const where: Row = { run_id: runId }; if (q.departmentId) where.department_id = q.departmentId; if (q.employeeId) where.employee_id = q.employeeId;
    return toDtoPage(await this.entries.page(where, pageRequest({ sort: 'employee_name', dir: 'ASC', ...q }), q.q));
  }
  async entry(runId: string, entryId: string) {
    const e = await this.entries.findOne({ id: entryId, run_id: runId });
    if (!e) throw new ValidationError('Entry does not belong to this run');
    return { ...toDto(e), lines: toDtos(await this.entries.lines(entryId)) };
  }

  /** Builds one employee's payslip lines from salary + attendance + leave + tax + adjustments + loans, fetched concurrently. */
  private async plan(emp: DirectoryEntry, month: string, settings: ReturnType<typeof parseSettings>, cfg: Map<string, string>): Promise<EmployeePlan | null> {
    const { from, to } = monthRange(month);
    const salary = await this.salaries.activeFor(emp.employeeId, from, to);
    if (!salary) return null;
    const [att, leave, tds, comps, adj, loans] = await Promise.all([
      this.attendance.payrollInput(emp.employeeId, month), this.leave.monthly(emp.employeeId, month).catch(() => ({ paidLeaveDays: 0, unpaidLeaveDays: 0 })),
      this.tax.monthlyTds(emp.employeeId, month).catch(() => 0), this.structures.components(salary.structure_id), this.adjustments.pendingFor(emp.employeeId, month), this.loans.activeFor(emp.employeeId, month),
    ]);
    const workingDays = Number(att.workingDays) || 0;
    const lop = Math.min(workingDays, Number(att.absentDays) + Number(att.halfDays) * 0.5 + Number(leave.unpaidLeaveDays));
    const paidDays = Math.max(0, workingDays - lop);
    const monthlyCtc = Number(salary.annual_ctc) / 12;
    const components = comps.map((c) => ({ code: c.code, name: c.name, type: c.type, calcType: c.calc_type, value: Number(c.value), displayOrder: c.display_order }));
    const basicMonthly = components.find((c) => c.code === 'BASIC') ? (monthlyCtc * (components.find((c) => c.code === 'BASIC')!.value)) / 100 : 0;
    const hourly = workingDays > 0 ? basicMonthly / (workingDays * Number(cfg.get('payroll.standard_hours_per_day') ?? 8)) : 0;
    const overtimePay = Number(att.overtimeMinutes) > 0 ? await this.entries.overtimePay(Number(att.overtimeMinutes), hourly, Number(cfg.get('overtime.multiplier') ?? 2)) : 0;
    const loanPlans = loans.map((l) => ({ loanId: l.id as string, amount: Math.min(Number(l.emi), Number(l.outstanding)) }));
    const lines = calculateSalary({
      monthlyCtc, components, settings, attendance: { workingDays, paidDays, lopDays: lop, overtimeMinutes: Number(att.overtimeMinutes) }, overtimePay, tds: tds, loanEmi: loanPlans.reduce((a, l) => a + l.amount, 0),
      adjustments: adj.map((a) => ({ type: a.type, amount: Number(a.amount), description: a.description })),
    });
    return { emp, salary, lines, attendance: { workingDays, paidDays, lopDays: lop, overtimeMinutes: Number(att.overtimeMinutes) }, loans: loanPlans, adjustmentIds: adj.map((a) => a.id) };
  }

  /** (Re)calculates a DRAFT run. External lookups run in bounded parallel batches; persistence is one transaction. */
  async calculate(runId: string) {
    const run = await this.runs.getById(runId, 'Payroll run');
    if (run.status !== 'DRAFT') throw new BusinessRuleError('Only DRAFT runs can be calculated');
    const res = await withLock(`payroll-calc:${runId}`, 300000, async () => {
      const cfg = await this.salary.settings(); const settings = parseSettings(cfg);
      const employees = await this.employees.activeEmployees();
      const plans: EmployeePlan[] = []; const skipped: { employeeId: string; reason: string }[] = [];
      for (let i = 0; i < employees.length; i += payrollConfig.batchSize) {
        const batch = employees.slice(i, i + payrollConfig.batchSize);
        const settled = await Promise.allSettled(batch.map((e) => this.plan(e, run.payroll_month, settings, cfg)));
        settled.forEach((s, idx) => {
          if (s.status === 'fulfilled') { if (s.value) plans.push(s.value); else skipped.push({ employeeId: batch[idx].employeeId, reason: 'no active salary' }); }
          else { skipped.push({ employeeId: batch[idx].employeeId, reason: String(s.reason?.message ?? s.reason).slice(0, 120) }); logger.warn({ employeeId: batch[idx].employeeId, err: s.reason?.message }, 'payroll plan failed'); }
        });
      }
      await this.db.tx(async (conn) => {
        await this.entries.clearRun(runId, conn);
        for (const p of plans) {
          const t = totals(p.lines);
          const e = await this.entries.insert({
            run_id: runId, payroll_month: run.payroll_month, employee_id: p.emp.employeeId, employee_code: p.emp.employeeCode, employee_name: p.emp.fullName, department_id: p.emp.departmentId, salary_id: p.salary.id,
            working_days: p.attendance.workingDays, paid_days: p.attendance.paidDays, lop_days: p.attendance.lopDays, overtime_minutes: p.attendance.overtimeMinutes, gross: t.gross, deductions: t.deductions, net: t.net,
          }, conn);
          for (const l of p.lines) await this.db.exec('INSERT INTO payroll_entry_lines (id, created_at, updated_at, amount, component_code, component_name, entry_id, note, type) VALUES (UUID(),?,?,?,?,?,?,?,?)', [new Date(), new Date(), l.amount, l.code, l.name, e.id, l.note ?? null, l.type], conn);
          for (const ln of p.loans) await this.db.exec('INSERT INTO loan_deductions (id, created_at, updated_at, amount, employee_id, loan_id, run_id) VALUES (UUID(),?,?,?,?,?,?)', [new Date(), new Date(), ln.amount, p.emp.employeeId, ln.loanId, runId], conn);
        }
        await this.runs.update(runId, { employee_count: plans.length, note: skipped.length ? `${skipped.length} employee(s) skipped` : run.note }, conn);
        await audit(this.db, conn, 'PayrollRun', runId, 'CALCULATED', undefined, { employees: plans.length, skipped: skipped.length });
      });
      return { runId, calculated: plans.length, skipped };
    });
    if (!res) throw new ConflictError('This run is already being calculated');
    return res;
  }

  /** Finalises totals using the existing MySQL stored procedure (also applies adjustments and loan recoveries). */
  async process(runId: string, actor: AuthUser) {
    const run = await this.runs.getById(runId, 'Payroll run');
    if (run.status !== 'DRAFT') throw new BusinessRuleError('Only DRAFT runs can be processed');
    if (!(await this.entries.count({ run_id: runId }))) throw new BusinessRuleError('Calculate the run before processing it');
    await this.db.callProcedure('sp_process_monthly_payroll', [runId, actor.username]);
    await audit(this.db, undefined, 'PayrollRun', runId, 'PROCESSED');
    return this.get(runId);
  }

  async approve(runId: string, actor: AuthUser) {
    const run = await this.runs.getById(runId, 'Payroll run');
    if (run.status !== 'PROCESSED') throw new BusinessRuleError('Only PROCESSED runs can be approved');
    if (run.processed_by === actor.username) throw new ForbiddenError('Segregation of duties: the processor cannot approve the same run');
    await this.runs.update(runId, { status: 'APPROVED', approved_by: actor.username, approved_at: new Date() });
    await audit(this.db, undefined, 'PayrollRun', runId, 'APPROVED');
    return this.get(runId);
  }

  async finalize(runId: string, actor: AuthUser) {
    const run = await this.runs.getById(runId, 'Payroll run');
    if (run.status !== 'APPROVED') throw new BusinessRuleError('Only APPROVED runs can be finalized');
    await this.runs.update(runId, { status: 'FINALIZED', finalized_by: actor.username, finalized_at: new Date() });
    const generated = await this.payslips.generateForRun(runId, run.payroll_month);
    await this.db.tx(async (conn) => {
      await audit(this.db, conn, 'PayrollRun', runId, 'FINALIZED', undefined, { payslips: generated });
      await enqueueOutbox(this.db, conn, Topics.PAYROLL_PROCESSED, buildEvent(Topics.PAYROLL_PROCESSED, 'payroll-service', {
        runId, month: run.payroll_month, employeeCount: run.employee_count, totalNet: run.total_net, payslips: generated,
      }));
    });
    return this.get(runId);
  }

  /** Payroll report: department/component totals, aggregated in a worker thread for large runs. */
  async report(runId: string) {
    const run = await this.runs.getById(runId, 'Payroll run');
    const [byDept, lines] = await Promise.all([this.entries.byDepartment(runId), this.entries.linesForRun(runId)]);
    const byComponent = await aggregateInWorker<Row>(lines, ['component_code', 'type'], ['amount']);
    return { run: toDto(run), byDepartment: toDtos(byDept), byComponent: toDtos(byComponent.map((c) => ({ ...c, amount: round2(c.amount) }))) };
  }

  async employeeHistory(employeeId: string) {
    return toDtos(await this.db.query('SELECT payroll_month, gross, deductions, net, paid_days, lop_days, run_id FROM payroll_entries WHERE employee_id = ? ORDER BY payroll_month DESC LIMIT 36', [employeeId]));
  }
}
void requestContext; void upsertRow;
