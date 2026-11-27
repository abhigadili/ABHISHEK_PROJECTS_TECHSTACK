import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, audit, buildEvent, enqueueOutbox, hasPermission, pageRequest, toDto, toDtos, toDtoPage, round2,
} from '@hr/common';
import { taxConfig } from '../config';
import { DeclarationRepository, InvestmentRepository, ProofRepository, RuleRepository, TaxEmployeeRepository } from '../repositories/tax.repository';

type DeclStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
const EDITABLE: DeclStatus[] = ['DRAFT', 'REJECTED'];

export class DeclarationService {
  readonly declarations: DeclarationRepository; private readonly investments: InvestmentRepository; private readonly proofs: ProofRepository; private readonly rules: RuleRepository; private readonly employees: TaxEmployeeRepository;
  constructor(private readonly db: Db) {
    this.declarations = new DeclarationRepository(db); this.investments = new InvestmentRepository(db); this.proofs = new ProofRepository(db); this.rules = new RuleRepository(db); this.employees = new TaxEmployeeRepository(db);
  }

  private async load(id: string, viewer: AuthUser, write = false): Promise<Row> {
    const d = await this.declarations.getById(id, 'Tax declaration');
    const own = d.employee_id === viewer.employeeId;
    if (!own && !hasPermission(viewer, 'TAX_REVIEW', 'TAX_CONFIG')) throw new ForbiddenError('You may only access your own tax declaration');
    if (write && !own) throw new ForbiddenError('Only the employee can edit the declaration');
    return d;
  }
  private async history(conn: any, d: Row, action: string, comment?: string, status?: string): Promise<void> {
    await this.db.exec('INSERT INTO tax_declaration_history (id, created_at, updated_at, action, comment, declaration_id, status, total_declared) VALUES (UUID(),?,?,?,?,?,?,?)', [new Date(), new Date(), action, comment ?? null, d.id, status ?? d.status, d.total_declared], conn);
  }
  private async retotal(declarationId: string, conn: any): Promise<void> {
    const t = await this.investments.totals(declarationId, conn);
    await this.db.exec('UPDATE tax_declarations SET total_declared = ?, total_approved = ?, updated_at = ?, version = version + 1 WHERE id = ?', [t!.declared, t!.approved, new Date(), declarationId], conn);
  }

  async create(user: AuthUser, dto: { financialYear: string; regime: 'OLD' | 'NEW' }) {
    if (!user.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    if (await this.declarations.findOne({ employee_id: user.employeeId, financial_year: dto.financialYear })) throw new ConflictError('A declaration already exists for this financial year');
    if (!(await this.rules.find(dto.financialYear, dto.regime))) throw new BusinessRuleError(`No active ${dto.regime} tax rules configured for ${dto.financialYear}`);
    const emp = await this.employees.findById(user.employeeId);
    const d = await this.db.tx(async (conn) => {
      const row = await this.declarations.insert({ employee_id: user.employeeId, employee_name: emp?.full_name ?? null, financial_year: dto.financialYear, regime: dto.regime, status: 'DRAFT', total_declared: 0, total_approved: 0, version: 0 }, conn);
      await this.history(conn, row, 'CREATED');
      return row;
    });
    return this.get(d.id, user);
  }

  async get(id: string, viewer: AuthUser) {
    const d = await this.load(id, viewer);
    const [inv, proofs, history] = await Promise.all([this.investments.findAll({ declaration_id: id }, { by: 'created_at' }), this.proofs.findAll({ declaration_id: id }, { by: 'created_at' }), this.declarations.history(id)]);
    return { ...toDto(d), investments: toDtos(inv), proofs: toDtos(proofs), history: toDtos(history) };
  }

  async list(viewer: AuthUser, q: Row) {
    const where: Row = {};
    if (q.financialYear) where.financial_year = q.financialYear; if (q.status) where.status = q.status;
    if (hasPermission(viewer, 'TAX_REVIEW', 'TAX_CONFIG')) { if (q.employeeId) where.employee_id = q.employeeId; } else where.employee_id = viewer.employeeId ?? '-';
    return toDtoPage(await this.declarations.page(where, pageRequest(q), q.q));
  }

  async mine(user: AuthUser, fy: string) {
    const d = await this.declarations.findOne({ employee_id: user.employeeId ?? '-', financial_year: fy });
    return d ? this.get(d.id, user) : null;
  }

  async setRegime(id: string, regime: 'OLD' | 'NEW', user: AuthUser) {
    const d = await this.load(id, user, true);
    if (!EDITABLE.includes(d.status)) throw new BusinessRuleError('The regime can only be changed while the declaration is a draft');
    if (!(await this.rules.find(d.financial_year, regime))) throw new BusinessRuleError(`No active ${regime} rules for ${d.financial_year}`);
    await this.db.tx(async (conn) => { await this.declarations.update(id, { regime }, conn); await this.history(conn, d, 'REGIME_CHANGED', regime); await audit(this.db, conn, 'TaxDeclaration', id, 'REGIME_CHANGED', { regime: d.regime }, { regime }); });
    return this.get(id, user);
  }

  async addInvestment(id: string, dto: Row, user: AuthUser) {
    const d = await this.load(id, user, true);
    if (!EDITABLE.includes(d.status)) throw new BusinessRuleError('Investments can only be edited while the declaration is a draft or rejected');
    if (d.regime === 'NEW') throw new BusinessRuleError('Investment declarations apply to the OLD regime; switch regime first');
    const rule = await this.rules.find(d.financial_year, d.regime);
    const limit = rule ? ((typeof rule.section_limits === 'string' ? JSON.parse(rule.section_limits) : rule.section_limits) as Record<string, number>)[dto.section] : undefined;
    if (rule && limit === undefined) throw new ValidationError(`Section ${dto.section} is not recognised for ${d.financial_year}`);
    await this.db.tx(async (conn) => {
      await this.investments.insert({ declaration_id: id, section: dto.section, description: dto.description, declared_amount: dto.declaredAmount, approved_amount: 0, status: 'DECLARED' }, conn);
      await this.retotal(id, conn); await this.history(conn, d, 'INVESTMENT_ADDED', dto.section);
    });
    return this.get(id, user);
  }
  async removeInvestment(id: string, invId: string, user: AuthUser) {
    const d = await this.load(id, user, true);
    if (!EDITABLE.includes(d.status)) throw new BusinessRuleError('Investments can only be edited while the declaration is a draft or rejected');
    if (!(await this.investments.findOne({ id: invId, declaration_id: id }))) throw new NotFoundError('Investment', invId);
    await this.db.tx(async (conn) => { await this.investments.remove(invId, conn); await this.retotal(id, conn); await this.history(conn, d, 'INVESTMENT_REMOVED'); });
    return this.get(id, user);
  }

  async submit(id: string, user: AuthUser) {
    const d = await this.load(id, user, true);
    if (!EDITABLE.includes(d.status)) throw new BusinessRuleError(`Declaration is already ${d.status}`);
    if (d.regime === 'OLD' && !(await this.investments.count({ declaration_id: id }))) throw new BusinessRuleError('Add at least one investment or choose the NEW regime');
    await this.db.tx(async (conn) => {
      await this.declarations.update(id, { status: 'SUBMITTED', submitted_at: new Date() }, conn);
      await this.history(conn, d, 'SUBMITTED', undefined, 'SUBMITTED'); await audit(this.db, conn, 'TaxDeclaration', id, 'SUBMITTED', { status: d.status }, { status: 'SUBMITTED' });
      await enqueueOutbox(this.db, conn, Topics.TAX_DECLARATION_SUBMITTED, buildEvent(Topics.TAX_DECLARATION_SUBMITTED, 'tax-service', { declarationId: id, employeeId: d.employee_id, financialYear: d.financial_year, regime: d.regime, totalDeclared: d.total_declared }, d.employee_id));
    });
    return this.get(id, user);
  }

  // ---------------------------------------------------------------- proofs
  async submitProof(id: string, dto: { investmentId: string; documentId: string; fileName?: string }, user: AuthUser) {
    const d = await this.load(id, user, true);
    if (!['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(d.status)) throw new BusinessRuleError('Submit the declaration before uploading proofs');
    const inv = await this.investments.findOne({ id: dto.investmentId, declaration_id: id });
    if (!inv) throw new NotFoundError('Investment', dto.investmentId);
    if (inv.status === 'VERIFIED') throw new ConflictError('This investment is already verified');
    const attempts = await this.proofs.count({ investment_id: dto.investmentId });
    if (attempts >= taxConfig.maxProofAttempts) throw new BusinessRuleError(`Maximum of ${taxConfig.maxProofAttempts} proof submissions reached`);
    await this.db.tx(async (conn) => {
      await this.proofs.insert({ declaration_id: id, investment_id: dto.investmentId, document_id: dto.documentId, file_name: dto.fileName ?? null, attempt_number: attempts + 1, status: 'SUBMITTED' }, conn);
      await this.investments.update(dto.investmentId, { status: 'PROOF_SUBMITTED' }, conn);
      await this.declarations.update(id, { status: 'UNDER_REVIEW' }, conn);
      await this.history(conn, d, attempts ? 'PROOF_RESUBMITTED' : 'PROOF_SUBMITTED', inv.section, 'UNDER_REVIEW');
    });
    return this.get(id, user);
  }

  async verifyProof(proofId: string, dto: { approvedAmount?: number; comment?: string }, reviewer: AuthUser) {
    const p = await this.proofs.getById(proofId, 'Proof'); const inv = await this.investments.getById(p.investment_id, 'Investment'); const d = await this.declarations.getById(p.declaration_id);
    if (d.employee_id === reviewer.employeeId) throw new ForbiddenError('You cannot review your own proofs');
    if (p.status !== 'SUBMITTED') throw new BusinessRuleError(`Proof is already ${p.status}`);
    const approved = Math.min(dto.approvedAmount ?? Number(inv.declared_amount), Number(inv.declared_amount));
    await this.db.tx(async (conn) => {
      await this.proofs.update(proofId, { status: 'VERIFIED', reviewer_id: reviewer.userId, reviewed_at: new Date(), reviewer_comment: dto.comment ?? null }, conn);
      await this.investments.update(inv.id, { status: 'VERIFIED', approved_amount: approved }, conn);
      await this.retotal(d.id, conn); await this.history(conn, d, 'PROOF_VERIFIED', inv.section);
    });
    return this.get(d.id, reviewer);
  }

  async rejectProof(proofId: string, comment: string, reviewer: AuthUser) {
    const p = await this.proofs.getById(proofId, 'Proof'); const inv = await this.investments.getById(p.investment_id, 'Investment'); const d = await this.declarations.getById(p.declaration_id);
    if (p.status !== 'SUBMITTED') throw new BusinessRuleError(`Proof is already ${p.status}`);
    await this.db.tx(async (conn) => {
      await this.proofs.update(proofId, { status: 'REJECTED', reviewer_id: reviewer.userId, reviewed_at: new Date(), reviewer_comment: comment }, conn);
      await this.investments.update(inv.id, { status: 'REJECTED', approved_amount: 0 }, conn);
      await this.retotal(d.id, conn); await this.history(conn, d, 'PROOF_REJECTED', comment);
      await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'tax-service', {
        type: 'TAX_PROOF_REJECTED', recipientEmployeeId: d.employee_id, subject: 'Tax proof rejected', body: `Your proof for section ${inv.section} was rejected: ${comment}. You may resubmit.`, referenceType: 'TaxDeclaration', referenceId: d.id,
      }, d.employee_id));
    });
    return this.get(d.id, reviewer);
  }

  async approve(id: string, comment: string | undefined, reviewer: AuthUser) {
    const d = await this.declarations.getById(id, 'Tax declaration');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(d.status)) throw new BusinessRuleError(`Declaration is ${d.status}`);
    if (d.employee_id === reviewer.employeeId) throw new ForbiddenError('You cannot approve your own declaration');
    const pending = await this.investments.count({ declaration_id: id, status: ['DECLARED', 'PROOF_SUBMITTED'] });
    await this.db.tx(async (conn) => {
      // NEW regime has no deductions; OLD regime unverified lines count at declared value until proofs arrive (provisional approval)
      await this.db.exec("UPDATE investment_declarations SET approved_amount = declared_amount WHERE declaration_id = ? AND status IN ('DECLARED','PROOF_SUBMITTED')", [id], conn);
      await this.declarations.update(id, { status: 'APPROVED', reviewer_id: reviewer.userId, reviewed_at: new Date(), review_comment: comment ?? null }, conn);
      await this.retotal(id, conn); await this.history(conn, d, pending ? 'APPROVED_PROVISIONALLY' : 'APPROVED', comment, 'APPROVED');
      await audit(this.db, conn, 'TaxDeclaration', id, 'APPROVED', undefined, { pendingProofs: pending });
    });
    return this.get(id, reviewer);
  }

  async reject(id: string, comment: string, reviewer: AuthUser) {
    const d = await this.declarations.getById(id, 'Tax declaration');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(d.status)) throw new BusinessRuleError(`Declaration is ${d.status}`);
    await this.db.tx(async (conn) => {
      await this.declarations.update(id, { status: 'REJECTED', reviewer_id: reviewer.userId, reviewed_at: new Date(), review_comment: comment }, conn);
      await this.history(conn, d, 'REJECTED', comment, 'REJECTED'); await audit(this.db, conn, 'TaxDeclaration', id, 'REJECTED', undefined, { comment });
    });
    return this.get(id, reviewer);
  }

  /** Reminder run: every active employee without a submitted declaration gets a notification event. */
  async sendReminders(fy: string): Promise<number> {
    const emps = await this.employees.findAll({ status: 'ACTIVE' }, undefined, 5000);
    const done = new Set((await this.declarations.findAll({ financial_year: fy, status: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] }, undefined, 5000)).map((d) => d.employee_id as string));
    const todo = emps.filter((e) => !done.has(e.employee_id));
    await this.db.tx(async (conn) => {
      for (const e of todo) {
        await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'tax-service', {
          type: 'TAX_DECLARATION_REMINDER', recipientEmployeeId: e.employee_id, subject: `Tax declaration reminder (${fy})`, body: `Please submit your tax regime and investment declaration for ${fy}.`, dedupeKey: `taxrem:${fy}:${e.employee_id}`,
        }, e.employee_id));
      }
    });
    return todo.length;
  }
}
void round2;
