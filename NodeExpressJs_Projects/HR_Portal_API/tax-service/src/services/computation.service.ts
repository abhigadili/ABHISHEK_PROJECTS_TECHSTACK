import {
  AuthUser, BusinessRuleError, Db, ForbiddenError, NotFoundError, Row, audit, cache, financialYear, hasPermission, key, renderPdf, round2, toDto, toDtos, ValidationError, fileStorage, monthRange,
} from '@hr/common';
import { PayrollClient } from '../clients/payroll.client';
import { taxConfig } from '../config';
import { ComputationRepository, DeclarationRepository, InvestmentRepository, RuleRepository, TaxDocumentRepository, TdsRepository } from '../repositories/tax.repository';
import { computeTax, ruleFromRow, TaxResult } from './tax-calculator';

export class ComputationService {
  private readonly rules: RuleRepository; private readonly comps: ComputationRepository; private readonly decl: DeclarationRepository; private readonly inv: InvestmentRepository;
  private readonly tds: TdsRepository; private readonly docs: TaxDocumentRepository; private readonly payroll = new PayrollClient();
  constructor(private readonly db: Db) {
    this.rules = new RuleRepository(db); this.comps = new ComputationRepository(db); this.decl = new DeclarationRepository(db); this.inv = new InvestmentRepository(db);
    this.tds = new TdsRepository(db); this.docs = new TaxDocumentRepository(db);
  }

  // ---- rules (configurable, financial-year based)
  listRules(fy?: string) { return this.rules.findAll(fy ? { financial_year: fy } : {}, { by: 'financial_year', dir: 'DESC' }).then((r) => toDtos(r)); }
  async upsertRule(dto: Row) {
    const existing = await this.db.one<Row>('SELECT id FROM tax_rules WHERE financial_year = ? AND regime = ?', [dto.financialYear, dto.regime]);
    const row = { financial_year: dto.financialYear, regime: dto.regime, standard_deduction: dto.standardDeduction, rebate_limit: dto.rebateLimit, rebate_amount: dto.rebateAmount, cess_percent: dto.cessPercent, slabs: dto.slabs, section_limits: dto.sectionLimits, active: dto.active ? 1 : 0 };
    if (existing) await this.rules.update(existing.id, row); else await this.rules.insert(row);
    await audit(this.db, undefined, 'TaxRule', `${dto.financialYear}:${dto.regime}`, existing ? 'UPDATED' : 'CREATED', undefined, { fy: dto.financialYear });
    await cache.evictPrefix(key('tax'));
    return this.listRules(dto.financialYear);
  }
  private async rule(fy: string, regime: string) {
    const r = await cache.getOrLoad(key('tax', 'rule', fy, regime), taxConfig.rulesTtl, async () => await this.rules.find(fy, regime));
    if (!r) throw new BusinessRuleError(`No active ${regime} tax rules configured for ${fy}`);
    return ruleFromRow(r);
  }

  private assertAccess(viewer: AuthUser, employeeId: string): void {
    if (viewer.employeeId === employeeId || hasPermission(viewer, 'TAX_REVIEW', 'TAX_CONFIG')) return;
    throw new ForbiddenError('You may only view your own tax information');
  }

  /** Computation for an employee: gross from payroll (or override), deductions from the declaration. Persisted in tax_computations. */
  async compute(viewer: AuthUser, employeeId: string, fy: string, grossOverride?: number, regimeOverride?: 'OLD' | 'NEW', persist = true) {
    this.assertAccess(viewer, employeeId);
    const declaration = await this.decl.findOne({ employee_id: employeeId, financial_year: fy });
    const regime = regimeOverride ?? declaration?.regime ?? 'NEW';
    const gross = grossOverride ?? (await this.payroll.annualGross(employeeId));
    if (!gross) throw new ValidationError('Gross income is unknown: provide grossIncome or assign a salary in payroll');
    const rule = await this.rule(fy, regime);
    const lines = declaration && regime === 'OLD'
      ? (await this.inv.findAll({ declaration_id: declaration.id })).filter((i) => i.status !== 'REJECTED').map((i) => ({ section: i.section as string, amount: Number(declaration.status === 'APPROVED' ? i.approved_amount : i.declared_amount) })) : [];
    const result = computeTax(gross, rule, lines);
    if (persist) await this.save(employeeId, fy, regime, result, declaration?.status === 'APPROVED');
    return { employeeId, financialYear: fy, regime, declarationStatus: declaration?.status ?? null, ...result };
  }

  private async save(employeeId: string, fy: string, regime: string, r: TaxResult, approved: boolean): Promise<void> {
    const row = { employee_id: employeeId, financial_year: fy, regime, gross_income: r.grossIncome, standard_deduction: r.standardDeduction, total_deductions: r.totalDeductions, taxable_income: r.taxableIncome, slab_tax: r.slabTax, rebate: r.rebate, cess: r.cess, total_tax: r.totalTax, declaration_approved: approved ? 1 : 0, computed_at: new Date() };
    const existing = await this.comps.findOne({ employee_id: employeeId, financial_year: fy });
    if (existing) await this.comps.update(existing.id, row); else await this.comps.insert(row);
  }

  /** Monthly TDS = (annual tax - TDS already deducted in the FY) / remaining months. Called by Payroll. */
  async monthlyTds(viewer: AuthUser, employeeId: string, month: string) {
    const fy = financialYear(`${month}-01`);
    const m = Number(month.slice(5, 7)); const remaining = m >= 4 ? 12 - (m - 4) : 4 - m;
    let comp: any;
    const elevated: AuthUser = { ...viewer, permissions: [...viewer.permissions, 'TAX_REVIEW'] }; // the route already authorised TAX_REVIEW or PAYROLL_PROCESS
    try { comp = await this.compute(elevated, employeeId, fy, undefined, undefined, true); } catch (e: any) { if (e.status === 422 || e.status === 400) throw new NotFoundError('Tax computation', employeeId); throw e; }
    const paid = await this.tds.paidBefore(employeeId, fy, month);
    const tds = round2(Math.max(0, (comp.totalTax - paid) / Math.max(1, remaining)));
    const row = { employee_id: employeeId, financial_year: fy, tds_month: month, regime: comp.regime, tds, declaration_approved: comp.declarationStatus === 'APPROVED' ? 1 : 0, computed_at: new Date() };
    const existing = await this.db.one<Row>('SELECT id FROM monthly_tds WHERE employee_id = ? AND tds_month = ?', [employeeId, month]);
    if (existing) await this.tds.update(existing.id, row); else await this.tds.insert(row);
    return { employeeId, month, financialYear: fy, regime: comp.regime, annualTax: comp.totalTax, alreadyDeducted: paid, remainingMonths: remaining, tds };
  }

  async annualSummary(viewer: AuthUser, employeeId: string, fy: string) {
    this.assertAccess(viewer, employeeId);
    const [computation, monthly, declaration, documents] = await Promise.all([
      this.compute(viewer, employeeId, fy).catch(() => null), this.db.query('SELECT tds_month, tds, regime FROM monthly_tds WHERE employee_id = ? AND financial_year = ? ORDER BY tds_month', [employeeId, fy]),
      this.decl.findOne({ employee_id: employeeId, financial_year: fy }), this.docs.findAll({ employee_id: employeeId, financial_year: fy }),
    ]);
    const deducted = round2(monthly.reduce((a, r) => a + Number(r.tds), 0));
    return { employeeId, financialYear: fy, computation, monthlyTds: toDtos(monthly), totalTdsDeducted: deducted, balanceTax: computation ? round2(computation.totalTax - deducted) : null, declaration: declaration ? toDto(declaration, ['id', 'status', 'regime', 'totalDeclared', 'totalApproved']) : null, documents: toDtos(documents) };
  }

  /** Income-tax computation statement as a PDF (rendered on a worker thread). */
  async statementPdf(viewer: AuthUser, employeeId: string, fy: string): Promise<Buffer> {
    const s = await this.annualSummary(viewer, employeeId, fy);
    if (!s.computation) throw new BusinessRuleError('No computation available for this employee/year');
    const c = s.computation; const f = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    return renderPdf({
      title: 'Income Tax Computation Statement', subtitle: `Financial year ${fy} - ${c.regime} regime`,
      sections: [
        { heading: 'Computation', table: { columns: ['Item', 'Amount'], rows: [['Gross income', f(c.grossIncome)], ['Standard deduction', f(c.standardDeduction)], ['Chapter VI-A deductions', f(c.totalDeductions)], ['Taxable income', f(c.taxableIncome)], ['Tax on slabs', f(c.slabTax)], ['Rebate', f(c.rebate)], ['Cess', f(c.cess)], ['Total tax', f(c.totalTax)]] } },
        { heading: 'TDS deducted', table: { columns: ['Month', 'TDS'], rows: [...s.monthlyTds.map((m: any) => [m.tdsMonth, f(m.tds)]), ['Total', f(s.totalTdsDeducted)]] } },
      ],
      footer: 'Computed from configured tax rules; verify before filing.',
    });
  }

  // ---- Form 16 / tax documents (files live in the Document Service)
  async registerDocument(dto: Row) { return toDto(await this.docs.insert({ employee_id: dto.employeeId, financial_year: dto.financialYear, doc_type: dto.docType, document_id: dto.documentId, file_name: dto.fileName ?? null })); }
  async listDocuments(viewer: AuthUser, employeeId: string, fy?: string) { this.assertAccess(viewer, employeeId); return toDtos(await this.docs.findAll({ employee_id: employeeId, ...(fy ? { financial_year: fy } : {}) }, { by: 'created_at', dir: 'DESC' })); }
  async saveStatement(viewer: AuthUser, employeeId: string, fy: string) {
    const pdf = await this.statementPdf(viewer, employeeId, fy);
    const stored = await fileStorage.save(`tax/${fy}`, `tax-statement-${employeeId}-${fy}.pdf`, pdf);
    return stored;
  }
}
void monthRange;
