import {
  AuthUser, BusinessRuleError, Db, ForbiddenError, NotFoundError, Row, ValidationError, audit, hasPermission, toDto, toDtos, today, Topics, buildEvent, enqueueOutbox,
} from '@hr/common';
import { FormRepository, InterviewRepository, TaskRepository } from '../repositories/exit.repository';
import type { ResignationService } from './resignation.service';

export class ExitTasksService {
  private readonly forms: FormRepository; private readonly interviews: InterviewRepository; private readonly tasks: TaskRepository;
  constructor(private readonly db: Db, private readonly core: ResignationService) { this.forms = new FormRepository(db); this.interviews = new InterviewRepository(db); this.tasks = new TaskRepository(db); }

  /** Who may close a task: the employee for checklist/KT; department owners for clearances; HR for assets/access. */
  private canComplete(u: AuthUser, r: Row, t: Row): boolean {
    if (hasPermission(u, 'EXIT_MANAGE')) return true;
    if (t.task_type === 'CLEARANCE') {
      if (t.department === 'MANAGER') return r.manager_id === u.employeeId && r.employee_id !== u.employeeId;
      if (t.department === 'FINANCE') return hasPermission(u, 'PAYROLL_VIEW');
      return false;
    }
    return r.employee_id === u.employeeId && ['CHECKLIST', 'KT'].includes(t.task_type);
  }

  async list(resignationId: string, u: AuthUser) { const r = await this.core.resignations.getById(resignationId, 'Resignation'); await this.core.assertView(u, r); return toDtos(await this.tasks.forResignation(resignationId)); }

  async addTask(resignationId: string, dto: Row, u: AuthUser) {
    const r = await this.core.resignations.getById(resignationId, 'Resignation');
    if (!hasPermission(u, 'EXIT_MANAGE')) throw new ForbiddenError();
    if (!['HR_CONFIRMED', 'CLEARED'].includes(r.status)) throw new BusinessRuleError('Tasks can only be added once the exit is confirmed and before interview');
    const t = await this.tasks.insert({ resignation_id: resignationId, task_type: dto.taskType, title: dto.title, due_date: dto.dueDate ?? r.confirmed_last_working_day, status: 'PENDING', system_name: dto.systemName ?? null, asset_tag: dto.assetTag ?? null, kt_topic: dto.ktTopic ?? null });
    if (r.status === 'CLEARED') await this.db.tx(async (conn) => this.core.transition(conn, r, 'HR_CONFIRMED', {}, 'New task added'));
    return toDto(t);
  }

  async complete(resignationId: string, taskId: string, dto: Row, u: AuthUser) {
    const r = await this.core.resignations.getById(resignationId, 'Resignation');
    const t = await this.tasks.findOne({ id: taskId, resignation_id: resignationId }); if (!t) throw new NotFoundError('Task', taskId);
    if (r.status !== 'HR_CONFIRMED') throw new BusinessRuleError(`Tasks can only be completed while the exit is HR_CONFIRMED (now ${r.status})`);
    if (t.status === 'DONE') throw new BusinessRuleError('Task is already complete');
    if (!this.canComplete(u, r, t)) throw new ForbiddenError('You cannot complete this task');
    if (t.task_type === 'ASSET' && !(dto.assetTag ?? t.asset_tag)) throw new ValidationError('assetTag is required to confirm asset return');
    if (t.task_type === 'ACCESS' && !(dto.systemName ?? t.system_name)) throw new ValidationError('systemName is required to confirm access revocation');
    if (t.task_type === 'KT' && !(dto.ktTransfereeId ?? t.kt_transferee_id)) throw new ValidationError('ktTransfereeId (who receives the knowledge) is required');
    await this.db.tx(async (conn) => {
      await this.tasks.update(taskId, {
        status: 'DONE', completed_at: new Date(), completed_by: u.userId, remarks: dto.remarks ?? null, asset_tag: dto.assetTag, asset_condition: dto.assetCondition, returned_on: dto.returnedOn ?? (t.task_type === 'ASSET' ? today() : undefined),
        system_name: dto.systemName, revoked_on: dto.revokedOn ?? (t.task_type === 'ACCESS' ? today() : undefined), kt_topic: dto.ktTopic, kt_transferee_id: dto.ktTransfereeId,
      }, conn);
      await audit(this.db, conn, 'ExitTask', taskId, 'COMPLETED', undefined, { type: t.task_type, department: t.department });
      const open = await this.db.scalar<number>("SELECT COUNT(*) FROM exit_tasks WHERE resignation_id = ? AND status = 'PENDING'", [resignationId], conn);
      if (Number(open) === 0) await this.core.transition(conn, r, 'CLEARED', {}, 'All exit tasks and clearances completed');
    });
    return this.core.get(resignationId, u);
  }

  // ---------------------------------------------------------------- exit interview
  listForms() { return this.forms.findAll({ active: 1 }, { by: 'name' }).then((r) => toDtos(r)); }
  async createForm(dto: Row) { return toDto(await this.forms.insert({ name: dto.name, active: dto.active ? 1 : 0, questions: dto.questions.map((q: Row) => ({ ...q, required: String(q.required) })) })); }
  async updateForm(id: string, dto: Row) {
    await this.forms.getById(id, 'Exit interview form');
    await this.forms.update(id, { name: dto.name, ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}), ...(dto.questions ? { questions: dto.questions.map((q: Row) => ({ ...q, required: String(q.required) })) } : {}) });
    return toDto(await this.forms.getById(id));
  }

  async schedule(resignationId: string, dto: { formId?: string; scheduledAt: string }, u: AuthUser) {
    const r = await this.core.resignations.getById(resignationId, 'Resignation');
    if (!['HR_CONFIRMED', 'CLEARED'].includes(r.status)) throw new BusinessRuleError('Interviews are scheduled after HR confirmation');
    if (await this.interviews.findOne({ resignation_id: resignationId })) throw new BusinessRuleError('An exit interview already exists for this resignation');
    const form = dto.formId ? await this.forms.getById(dto.formId, 'Exit interview form') : await this.forms.findOne({ active: 1 });
    if (!form) throw new BusinessRuleError('No exit interview form is configured');
    const i = await this.interviews.insert({ resignation_id: resignationId, form_id: form.id, scheduled_at: new Date(dto.scheduledAt), status: 'SCHEDULED', conducted_by: u.userId });
    await enqueueOutbox(this.db, undefined, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'exit-service', { type: 'EXIT_INTERVIEW_SCHEDULED', recipientEmployeeId: r.employee_id, subject: 'Exit interview scheduled', body: `Your exit interview is on ${dto.scheduledAt}.`, referenceType: 'Resignation', referenceId: resignationId }, r.employee_id));
    return toDto(i);
  }

  async completeInterview(resignationId: string, dto: { answers: { questionId: string; answer: string | number }[]; wouldRecommend?: boolean; feedbackSummary?: string }, u: AuthUser) {
    const r = await this.core.resignations.getById(resignationId, 'Resignation');
    if (!hasPermission(u, 'EXIT_MANAGE')) throw new ForbiddenError('Only HR conducts exit interviews');
    if (r.status !== 'CLEARED') throw new BusinessRuleError('The exit interview is completed after all clearances (status CLEARED)');
    const iv = await this.interviews.findOne({ resignation_id: resignationId }); if (!iv) throw new BusinessRuleError('Schedule the exit interview first');
    const form = await this.forms.getById(iv.form_id); const questions = (typeof form.questions === 'string' ? JSON.parse(form.questions) : form.questions) as { id: string; type: string; required: string | boolean; text: string }[];
    const byQ = new Map(dto.answers.map((a) => [a.questionId, a.answer]));
    for (const q of questions) {
      const a = byQ.get(q.id);
      if ((q.required === true || q.required === 'true') && (a === undefined || a === '')) throw new ValidationError(`Question "${q.text.slice(0, 40)}" is required`);
      if (a !== undefined && q.type === 'RATING' && !(typeof a === 'number' && a >= 1 && a <= 5)) throw new ValidationError(`Question "${q.text.slice(0, 40)}" needs a rating 1-5`);
    }
    for (const id of byQ.keys()) if (!questions.some((q) => q.id === id)) throw new ValidationError(`Unknown question ${id}`);
    await this.db.tx(async (conn) => {
      await this.interviews.update(iv.id, { answers: dto.answers, would_recommend: dto.wouldRecommend === undefined ? null : dto.wouldRecommend ? 1 : 0, feedback_summary: dto.feedbackSummary ?? null, status: 'COMPLETED', completed_at: new Date(), conducted_by: u.userId }, conn);
      await this.core.transition(conn, r, 'INTERVIEW_DONE', {}, 'Exit interview completed');
    });
    return this.core.get(resignationId, u);
  }
}
