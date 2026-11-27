import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, Row, Topics, ValidationError, audit, buildEvent, enqueueOutbox, hasPermission, pageRequest, round2, toDto, toDtos, toDtoPage, today,
} from '@hr/common';
import { perfConfig } from '../config';
import { AnswerRepository, CycleRepository, FormRepository, HistoryRepository, PerfEmployeeRepository, QuestionRepository, ReviewRepository } from '../repositories/performance.repository';

export class ReviewService {
  private readonly forms: FormRepository; private readonly questions: QuestionRepository; private readonly cycles: CycleRepository; private readonly reviews: ReviewRepository;
  private readonly answers: AnswerRepository; private readonly history: HistoryRepository; private readonly employees: PerfEmployeeRepository;
  constructor(private readonly db: Db) {
    this.forms = new FormRepository(db); this.questions = new QuestionRepository(db); this.cycles = new CycleRepository(db); this.reviews = new ReviewRepository(db);
    this.answers = new AnswerRepository(db); this.history = new HistoryRepository(db); this.employees = new PerfEmployeeRepository(db);
  }

  // ---------------------------------------------------------------- configurable evaluation forms
  async listForms() { return toDtos(await this.forms.findAll({}, { by: 'name' })); }
  async getForm(id: string) { const f = await this.forms.getById(id, 'Evaluation form'); return { ...toDto(f), questions: toDtos(await this.questions.forForm(id)) }; }
  private qRow(formId: string, q: Row) { return { form_id: formId, section: q.section, text: q.text, type: q.type, weight: q.weight, required: q.required ? 1 : 0, order_no: q.orderNo }; }
  async createForm(dto: Row) {
    const id = await this.db.tx(async (conn) => {
      const f = await this.forms.insert({ name: dto.name, description: dto.description ?? null, active: dto.active ? 1 : 0 }, conn);
      for (const q of dto.questions) await this.questions.insert(this.qRow(f.id, q), conn);
      await audit(this.db, conn, 'EvaluationForm', f.id, 'CREATED', undefined, { name: dto.name });
      return f.id as string;
    });
    return this.getForm(id);
  }
  async updateForm(id: string, dto: Row) {
    await this.forms.getById(id, 'Evaluation form');
    if (dto.questions && (await this.db.scalar<number>("SELECT COUNT(*) FROM review_cycles WHERE form_id = ? AND status <> 'DRAFT'", [id])) ) throw new BusinessRuleError('Form is used by an active/closed cycle; clone it instead of editing');
    await this.db.tx(async (conn) => {
      await this.forms.update(id, { name: dto.name, description: dto.description, ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}) }, conn);
      if (dto.questions) { await this.db.exec('DELETE FROM form_questions WHERE form_id = ?', [id], conn); for (const q of dto.questions) await this.questions.insert(this.qRow(id, q), conn); }
      await audit(this.db, conn, 'EvaluationForm', id, 'UPDATED');
    });
    return this.getForm(id);
  }

  // ---------------------------------------------------------------- cycles
  listCycles(status?: string) { return this.cycles.findAll(status ? { status } : {}, { by: 'period_start', dir: 'DESC' }).then((r) => toDtos(r)); }
  async createCycle(dto: Row) {
    await this.forms.getById(dto.formId, 'Evaluation form');
    const c = await this.cycles.insert({ name: dto.name, type: dto.type, form_id: dto.formId, period_start: dto.periodStart, period_end: dto.periodEnd, self_eval_deadline: dto.selfEvalDeadline, manager_eval_deadline: dto.managerEvalDeadline, status: 'DRAFT' });
    await audit(this.db, undefined, 'ReviewCycle', c.id, 'CREATED');
    return toDto(c);
  }
  /** Activating a cycle creates one review per active employee (idempotent on re-activation) and notifies them. */
  async activateCycle(id: string) {
    const c = await this.cycles.getById(id, 'Review cycle');
    if (c.status !== 'DRAFT') throw new BusinessRuleError(`Cycle is already ${c.status}`);
    const emps = await this.employees.findAll({ status: ['ACTIVE', 'ON_NOTICE'] }, undefined, 10000);
    if (!emps.length) throw new BusinessRuleError('No active employees to review');
    await this.db.tx(async (conn) => {
      await this.cycles.update(id, { status: 'ACTIVE' }, conn);
      for (const e of emps) {
        if (await this.reviews.findOne({ cycle_id: id, employee_id: e.employee_id }, conn)) continue;
        const r = await this.reviews.insert({ cycle_id: id, employee_id: e.employee_id, employee_name: e.full_name, manager_id: e.manager_id ?? null, form_id: c.form_id, status: 'SELF_PENDING', version: 0 }, conn);
        await this.history.add(conn, r.id, 'CREATED', 'SELF_PENDING');
        await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'performance-service', {
          type: 'PERFORMANCE_REVIEW_STARTED', recipientEmployeeId: e.employee_id, subject: `Performance review: ${c.name}`, body: `Your self evaluation is due by ${c.self_eval_deadline}.`, dedupeKey: `perf-start:${id}:${e.employee_id}`,
        }, e.employee_id));
      }
      await audit(this.db, conn, 'ReviewCycle', id, 'ACTIVATED', undefined, { reviews: emps.length });
    });
    return { cycle: toDto(await this.cycles.getById(id)), reviews: emps.length };
  }
  async closeCycle(id: string) {
    const c = await this.cycles.getById(id, 'Review cycle');
    if (c.status !== 'ACTIVE') throw new BusinessRuleError('Only ACTIVE cycles can be closed');
    const open = await this.reviews.count({ cycle_id: id, status: ['SELF_PENDING', 'SELF_SUBMITTED', 'MANAGER_SUBMITTED'] });
    await this.cycles.update(id, { status: 'CLOSED' }); await audit(this.db, undefined, 'ReviewCycle', id, 'CLOSED', undefined, { openReviews: open });
    return { cycle: toDto(await this.cycles.getById(id)), openReviews: open };
  }
  /** Reminder notifications for overdue/pending work, deduplicated per day. */
  async sendReminders(cycleId: string) {
    const c = await this.cycles.getById(cycleId, 'Review cycle');
    const pendingSelf = await this.reviews.findAll({ cycle_id: cycleId, status: 'SELF_PENDING' }, undefined, 10000);
    const pendingMgr = await this.reviews.findAll({ cycle_id: cycleId, status: 'SELF_SUBMITTED' }, undefined, 10000);
    await this.db.tx(async (conn) => {
      for (const r of pendingSelf) await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'performance-service', { type: 'PERFORMANCE_REVIEW_REMINDER', recipientEmployeeId: r.employee_id, subject: 'Self evaluation pending', body: `Please complete your self evaluation for ${c.name} (due ${c.self_eval_deadline}).`, dedupeKey: `perf-rem:${cycleId}:${r.employee_id}:${today()}` }, r.employee_id));
      for (const r of pendingMgr) if (r.manager_id) await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'performance-service', { type: 'PERFORMANCE_REVIEW_REMINDER', recipientEmployeeId: r.manager_id, subject: 'Manager evaluation pending', body: `Please evaluate ${r.employee_name} for ${c.name} (due ${c.manager_eval_deadline}).`, dedupeKey: `perf-rem-m:${cycleId}:${r.id}:${today()}` }, r.manager_id));
    });
    return { selfReminders: pendingSelf.length, managerReminders: pendingMgr.filter((r) => r.manager_id).length };
  }

  // ---------------------------------------------------------------- review access & views
  private canView(u: AuthUser, r: Row): boolean { return r.employee_id === u.employeeId || r.manager_id === u.employeeId || hasPermission(u, 'PERFORMANCE_MANAGE'); }

  async list(viewer: AuthUser, q: Row) {
    const where: Row = {}; if (q.cycleId) where.cycle_id = q.cycleId; if (q.status) where.status = q.status;
    if (hasPermission(viewer, 'PERFORMANCE_MANAGE')) { if (q.employeeId) where.employee_id = q.employeeId; }
    else if (q.employeeId && q.employeeId !== viewer.employeeId) { const e = await this.employees.findById(q.employeeId); if (e?.manager_id !== viewer.employeeId) throw new ForbiddenError(); where.employee_id = q.employeeId; }
    else if (hasPermission(viewer, 'PERFORMANCE_REVIEW') && !q.employeeId) where.manager_id = viewer.employeeId ?? '-';
    else where.employee_id = viewer.employeeId ?? '-';
    return toDtoPage(await this.reviews.page(where, pageRequest(q), q.q), ['id', 'cycleId', 'employeeId', 'employeeName', 'managerId', 'status', 'selfRating', 'managerRating', 'finalRating', 'selfSubmittedAt', 'managerSubmittedAt', 'approvedAt']);
  }

  async get(id: string, viewer: AuthUser) {
    const r = await this.reviews.getById(id, 'Performance review');
    if (!this.canView(viewer, r)) throw new ForbiddenError('You are not allowed to view this review');
    const [questions, answers, history, cycle] = await Promise.all([this.questions.forForm(r.form_id), this.answers.forReview(id), this.history.findAll({ review_id: id }, { by: 'created_at' }), this.cycles.findById(r.cycle_id)]);
    const isSubject = r.employee_id === viewer.employeeId;
    // an employee does not see manager answers/feedback until the review is approved
    const hideManager = isSubject && r.status !== 'APPROVED';
    const review = toDto(r); if (hideManager) { for (const k of ['managerFeedback', 'managerRating', 'finalRating', 'hrComment']) review[k] = null; }
    return { ...review, cycle: cycle ? toDto(cycle, ['id', 'name', 'type', 'periodStart', 'periodEnd', 'selfEvalDeadline', 'managerEvalDeadline', 'status']) : null, questions: toDtos(questions),
      answers: toDtos(answers.filter((a) => !(hideManager && a.respondent === 'MANAGER'))), history: toDtos(history) };
  }

  myCurrent(viewer: AuthUser) {
    return this.db.one<Row>("SELECT r.id FROM performance_reviews r JOIN review_cycles c ON c.id = r.cycle_id WHERE r.employee_id = ? AND c.status = 'ACTIVE' ORDER BY c.period_start DESC LIMIT 1", [viewer.employeeId ?? '-'])
      .then((r) => (r ? this.get(r.id as string, viewer) : null));
  }

  // ---------------------------------------------------------------- evaluation
  private async saveAnswers(reviewId: string, formId: string, respondent: 'SELF' | 'MANAGER', answers: Row[], conn: any): Promise<void> {
    const qs = new Map((await this.questions.forForm(formId)).map((q) => [q.id as string, q]));
    for (const a of answers) {
      const q = qs.get(a.questionId);
      if (!q) throw new ValidationError(`Question ${a.questionId} is not part of this form`);
      if (q.type === 'RATING' && a.rating === undefined) throw new ValidationError(`A rating is required for "${q.text.slice(0, 40)}"`);
      if (q.type === 'TEXT' && !a.answerText) throw new ValidationError(`An answer is required for "${q.text.slice(0, 40)}"`);
      await this.answers.save(reviewId, respondent, a as { questionId: string; rating?: number; answerText?: string }, conn);
    }
  }

  private async weighted(reviewId: string, formId: string, respondent: 'SELF' | 'MANAGER', conn?: any): Promise<number | null> {
    const qs = (await this.questions.forForm(formId)).filter((q) => q.type === 'RATING');
    const ans = new Map((await this.db.query<Row>('SELECT question_id, rating FROM review_answers WHERE review_id = ? AND respondent = ?', [reviewId, respondent], conn)).map((a) => [a.question_id as string, Number(a.rating)]));
    let num = 0; let den = 0;
    for (const q of qs) { const r = ans.get(q.id); if (r !== undefined && !Number.isNaN(r)) { num += r * Number(q.weight); den += Number(q.weight); } }
    return den ? round2(num / den) : null;
  }

  private async assertRequiredComplete(reviewId: string, formId: string, respondent: 'SELF' | 'MANAGER', conn: any): Promise<void> {
    const required = (await this.questions.forForm(formId)).filter((q) => q.required);
    const done = new Set((await this.db.query<Row>('SELECT question_id FROM review_answers WHERE review_id = ? AND respondent = ?', [reviewId, respondent], conn)).map((a) => a.question_id));
    const missing = required.filter((q) => !done.has(q.id));
    if (missing.length) throw new ValidationError(`${missing.length} required question(s) are unanswered`, missing.map((m) => m.id));
  }

  async saveSelf(id: string, answers: Row[], user: AuthUser) {
    const r = await this.reviews.getById(id, 'Performance review');
    if (r.employee_id !== user.employeeId) throw new ForbiddenError('Only the employee can fill the self evaluation');
    if (r.status !== 'SELF_PENDING') throw new BusinessRuleError('The self evaluation has already been submitted');
    await this.db.tx((conn) => this.saveAnswers(id, r.form_id, 'SELF', answers, conn));
    return this.get(id, user);
  }

  async submitSelf(id: string, dto: Row, user: AuthUser) {
    const r = await this.reviews.getById(id, 'Performance review');
    if (r.employee_id !== user.employeeId) throw new ForbiddenError();
    if (r.status !== 'SELF_PENDING') throw new BusinessRuleError('The self evaluation has already been submitted');
    const cycle = await this.cycles.getById(r.cycle_id);
    if (cycle.status !== 'ACTIVE') throw new BusinessRuleError('The review cycle is not active');
    if (today() > cycle.self_eval_deadline) throw new BusinessRuleError(`The self evaluation deadline (${cycle.self_eval_deadline}) has passed`);
    await this.db.tx(async (conn) => {
      await this.assertRequiredComplete(id, r.form_id, 'SELF', conn);
      const rating = await this.weighted(id, r.form_id, 'SELF', conn);
      await this.reviews.update(id, { status: 'SELF_SUBMITTED', self_rating: rating, self_submitted_at: new Date(), achievements: dto.achievements ?? null, strengths: dto.strengths ?? null, improvement_areas: dto.improvementAreas ?? null }, conn);
      await this.history.add(conn, id, 'SELF_SUBMITTED', 'SELF_SUBMITTED'); await audit(this.db, conn, 'PerformanceReview', id, 'SELF_SUBMITTED', undefined, { rating });
      await enqueueOutbox(this.db, conn, Topics.PERFORMANCE_REVIEW_SUBMITTED, buildEvent(Topics.PERFORMANCE_REVIEW_SUBMITTED, 'performance-service', { reviewId: id, stage: 'SELF', employeeId: r.employee_id, managerId: r.manager_id, cycle: cycle.name }, r.employee_id));
    });
    return this.get(id, user);
  }

  private assertManager(r: Row, u: AuthUser): void {
    if (r.employee_id === u.employeeId) throw new ForbiddenError('You cannot evaluate yourself');
    if (r.manager_id !== u.employeeId && !hasPermission(u, 'PERFORMANCE_MANAGE')) throw new ForbiddenError('Only the reporting manager can evaluate this review');
  }
  async saveManager(id: string, answers: Row[], user: AuthUser) {
    const r = await this.reviews.getById(id, 'Performance review'); this.assertManager(r, user);
    if (r.status !== 'SELF_SUBMITTED') throw new BusinessRuleError('The manager evaluation opens after the employee submits their self evaluation');
    await this.db.tx((conn) => this.saveAnswers(id, r.form_id, 'MANAGER', answers, conn));
    return this.get(id, user);
  }
  async submitManager(id: string, dto: Row, user: AuthUser) {
    const r = await this.reviews.getById(id, 'Performance review'); this.assertManager(r, user);
    if (r.status !== 'SELF_SUBMITTED') throw new BusinessRuleError('Review is not awaiting a manager evaluation');
    await this.db.tx(async (conn) => {
      await this.assertRequiredComplete(id, r.form_id, 'MANAGER', conn);
      const rating = await this.weighted(id, r.form_id, 'MANAGER', conn);
      await this.reviews.update(id, { status: 'MANAGER_SUBMITTED', manager_rating: rating, manager_feedback: dto.managerFeedback, manager_submitted_at: new Date(), strengths: dto.strengths ?? r.strengths, improvement_areas: dto.improvementAreas ?? r.improvement_areas }, conn);
      await this.history.add(conn, id, 'MANAGER_SUBMITTED', 'MANAGER_SUBMITTED'); await audit(this.db, conn, 'PerformanceReview', id, 'MANAGER_SUBMITTED', undefined, { rating });
      await enqueueOutbox(this.db, conn, Topics.PERFORMANCE_REVIEW_SUBMITTED, buildEvent(Topics.PERFORMANCE_REVIEW_SUBMITTED, 'performance-service', { reviewId: id, stage: 'MANAGER', employeeId: r.employee_id }, r.employee_id));
    });
    return this.get(id, user);
  }
  async approve(id: string, dto: { hrComment?: string; finalRating?: number }, user: AuthUser) {
    const r = await this.reviews.getById(id, 'Performance review');
    if (r.status !== 'MANAGER_SUBMITTED') throw new BusinessRuleError('Only manager-submitted reviews can be approved');
    if (r.employee_id === user.employeeId) throw new ForbiddenError('You cannot approve your own review');
    const w = perfConfig.managerWeight;
    const computed = r.manager_rating !== null && r.self_rating !== null ? round2(Number(r.manager_rating) * w + Number(r.self_rating) * (1 - w)) : r.manager_rating;
    const finalRating = dto.finalRating ?? computed;
    await this.db.tx(async (conn) => {
      await this.reviews.update(id, { status: 'APPROVED', final_rating: finalRating, hr_comment: dto.hrComment ?? null, approved_at: new Date() }, conn);
      await this.history.add(conn, id, 'APPROVED', 'APPROVED', dto.hrComment); await audit(this.db, conn, 'PerformanceReview', id, 'APPROVED', { computed }, { finalRating });
      await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'performance-service', { type: 'PERFORMANCE_REVIEW_APPROVED', recipientEmployeeId: r.employee_id, subject: 'Your performance review is finalised', body: 'Your review has been approved. You can now view the outcome.', referenceType: 'PerformanceReview', referenceId: id }, r.employee_id));
    });
    return this.get(id, user);
  }

  // ---------------------------------------------------------------- reports
  async cycleReport(cycleId: string) {
    const c = await this.cycles.getById(cycleId, 'Review cycle');
    const [stats, distribution] = await Promise.all([this.reviews.statsForCycle(cycleId), this.reviews.distribution(cycleId)]);
    const total = stats.byStatus.reduce((a, s) => a + Number(s.reviews), 0);
    return { cycle: toDto(c), totalReviews: total, byStatus: toDtos(stats.byStatus), averages: toDto(stats.ratings), byDepartment: toDtos(stats.byDepartment), ratingDistribution: toDtos(distribution) };
  }
  async employeeHistory(employeeId: string, viewer: AuthUser) {
    if (employeeId !== viewer.employeeId && !hasPermission(viewer, 'PERFORMANCE_MANAGE')) { const e = await this.employees.findById(employeeId); if (e?.manager_id !== viewer.employeeId) throw new ForbiddenError(); }
    const rows = await this.db.query<Row>(`SELECT r.id, r.cycle_id, c.name AS cycle_name, r.status, r.self_rating, r.manager_rating, r.final_rating, r.approved_at FROM performance_reviews r JOIN review_cycles c ON c.id = r.cycle_id WHERE r.employee_id = ? ORDER BY c.period_start DESC`, [employeeId]);
    const own = employeeId === viewer.employeeId;
    return toDtos(rows.map((r) => (own && r.status !== 'APPROVED' ? { ...r, manager_rating: null, final_rating: null } : r)));
  }
}
void ConflictError;
