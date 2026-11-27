import { BusinessRuleError, ConflictError, Db, Row, audit, toDto, toDtos } from '@hr/common';
import { AdjustmentRepository, LoanRepository, RunRepository } from '../repositories/payroll.repository';

export class AdjustmentService {
  private readonly adj: AdjustmentRepository; private readonly loans: LoanRepository; private readonly runs: RunRepository;
  constructor(private readonly db: Db) { this.adj = new AdjustmentRepository(db); this.loans = new LoanRepository(db); this.runs = new RunRepository(db); }

  async create(dto: Row) {
    const run = await this.runs.findOne({ payroll_month: dto.payrollMonth });
    if (run && run.status !== 'DRAFT') throw new BusinessRuleError(`Payroll for ${dto.payrollMonth} is already ${run.status}; use the next month`);
    if (dto.referenceId && dto.type === 'FINAL_SETTLEMENT' && (await this.adj.findOne({ reference_id: dto.referenceId, type: 'FINAL_SETTLEMENT', status: ['PENDING', 'APPLIED'] }))) throw new ConflictError('A settlement adjustment for this reference already exists');
    const r = await this.adj.insert({ employee_id: dto.employeeId, type: dto.type, amount: dto.amount, payroll_month: dto.payrollMonth, description: dto.description ?? null, reference_id: dto.referenceId ?? null, status: 'PENDING' });
    await audit(this.db, undefined, 'PayrollAdjustment', r.id, 'CREATED', undefined, { type: dto.type, month: dto.payrollMonth });
    return toDto(r);
  }
  list(employeeId?: string, month?: string) { return this.adj.findAll({ ...(employeeId ? { employee_id: employeeId } : {}), ...(month ? { payroll_month: month } : {}) }, { by: 'created_at', dir: 'DESC' }).then((r) => toDtos(r)); }
  async cancel(id: string) {
    const a = await this.adj.getById(id, 'Adjustment');
    if (a.status !== 'PENDING') throw new BusinessRuleError('Only pending adjustments can be cancelled');
    await this.adj.update(id, { status: 'CANCELLED' }); await audit(this.db, undefined, 'PayrollAdjustment', id, 'CANCELLED');
    return toDto(await this.adj.getById(id));
  }

  /** Gross monthly salary used by the exit settlement (restricted endpoint: EXIT_MANAGE / PAYROLL_PROCESS). */
  async settlementBasis(employeeId: string) {
    const s = await this.db.one<Row>("SELECT annual_ctc, currency FROM employee_salaries WHERE employee_id = ? AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1", [employeeId]);
    return s ? { monthlyGross: Math.round((Number(s.annual_ctc) / 12) * 100) / 100, currency: s.currency } : null;
  }

  /** Posts a settlement into the payroll month (idempotent per referenceId): positive => earning, negative => recovery. */
  async postSettlement(dto: Row) {
    const type = dto.amount > 0 ? 'FINAL_SETTLEMENT' : 'OTHER_DEDUCTION';
    const existing = await this.adj.findOne({ reference_id: dto.referenceId, status: ['PENDING', 'APPLIED'] });
    if (existing) return toDto(existing);
    // roll forward to the first payroll month that is still open (no run yet, or a DRAFT run)
    let [y, m] = String(dto.month).split('-').map(Number);
    for (let i = 0; i < 12; i++) {
      const month = `${y}-${String(m).padStart(2, '0')}`;
      const run = await this.runs.findOne({ payroll_month: month });
      if (!run || run.status === 'DRAFT') return this.create({ employeeId: dto.employeeId, type, amount: Math.abs(dto.amount), payrollMonth: month, description: dto.description, referenceId: dto.referenceId });
      if (++m > 12) { m = 1; y++; }
    }
    throw new BusinessRuleError('No open payroll month is available for the settlement');
  }

  async createLoan(dto: Row) {
    const l = await this.loans.insert({ employee_id: dto.employeeId, principal: dto.principal, outstanding: dto.principal, emi: dto.emi, start_month: dto.startMonth, description: dto.description, status: 'ACTIVE', version: 0 });
    await audit(this.db, undefined, 'Loan', l.id, 'CREATED', undefined, { employeeId: dto.employeeId });
    return toDto(l);
  }
  listLoans(employeeId?: string) { return this.loans.findAll(employeeId ? { employee_id: employeeId } : {}, { by: 'created_at', dir: 'DESC' }).then((r) => toDtos(r)); }
  async closeLoan(id: string) {
    const l = await this.loans.getById(id, 'Loan');
    if (l.status === 'CLOSED') return toDto(l);
    await this.loans.update(id, { status: 'CLOSED', outstanding: 0 }); await audit(this.db, undefined, 'Loan', id, 'CLOSED_EARLY');
    return toDto(await this.loans.getById(id));
  }
}
