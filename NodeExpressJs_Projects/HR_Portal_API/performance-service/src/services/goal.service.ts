import { AuthUser, BusinessRuleError, Db, ForbiddenError, NotFoundError, Row, audit, hasPermission, round2, toDto, toDtos, ValidationError } from '@hr/common';
import { FeedbackRepository, GoalRepository, KeyResultRepository, PerfEmployeeRepository } from '../repositories/performance.repository';

export class GoalService {
  private readonly goals: GoalRepository; private readonly krs: KeyResultRepository; private readonly feedback: FeedbackRepository; private readonly employees: PerfEmployeeRepository;
  constructor(private readonly db: Db) { this.goals = new GoalRepository(db); this.krs = new KeyResultRepository(db); this.feedback = new FeedbackRepository(db); this.employees = new PerfEmployeeRepository(db); }

  private async canSee(u: AuthUser, employeeId: string): Promise<void> {
    if (employeeId === u.employeeId || hasPermission(u, 'PERFORMANCE_MANAGE')) return;
    const e = await this.employees.findById(employeeId);
    if (e?.manager_id !== u.employeeId) throw new ForbiddenError('You may only view your own or your reports\' goals');
  }

  async list(u: AuthUser, q: { employeeId?: string; cycleId?: string }) {
    const employeeId = q.employeeId ?? u.employeeId; if (!employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    await this.canSee(u, employeeId);
    const goals = await this.goals.findAll({ employee_id: employeeId, ...(q.cycleId ? { cycle_id: q.cycleId } : {}) }, { by: 'created_at', dir: 'DESC' });
    const krs = goals.length ? await this.db.query<Row>(`SELECT * FROM key_results WHERE goal_id IN (${goals.map(() => '?').join(',')})`, goals.map((g) => g.id)) : [];
    return goals.map((g) => ({ ...toDto(g), keyResults: toDtos(krs.filter((k) => k.goal_id === g.id)) }));
  }

  private async assertWeight(employeeId: string, cycleId: string | null, add: number, excludeId?: string): Promise<void> {
    const used = await this.db.scalar<number>('SELECT COALESCE(SUM(weight),0) FROM goals WHERE deleted = 0 AND employee_id = ? AND status <> ? AND (cycle_id <=> ?) AND id <> ?', [employeeId, 'CANCELLED', cycleId, excludeId ?? '']);
    if (Number(used) + add > 100) throw new BusinessRuleError(`Goal weights for this cycle would total ${Number(used) + add}% (max 100%)`);
  }

  async create(u: AuthUser, dto: Row) {
    if (!u.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    await this.assertWeight(u.employeeId, dto.cycleId ?? null, dto.weight);
    const g = await this.goals.insert({ employee_id: u.employeeId, title: dto.title, description: dto.description ?? null, type: dto.type, cycle_id: dto.cycleId ?? null, target_date: dto.targetDate ?? null, weight: dto.weight, status: 'NOT_STARTED', progress: 0 });
    await audit(this.db, undefined, 'Goal', g.id, 'CREATED', undefined, { title: dto.title });
    return toDto(g);
  }
  private async own(u: AuthUser, id: string): Promise<Row> {
    const g = await this.goals.getById(id, 'Goal');
    if (g.employee_id !== u.employeeId && !hasPermission(u, 'PERFORMANCE_MANAGE')) { const e = await this.employees.findById(g.employee_id); if (e?.manager_id !== u.employeeId) throw new ForbiddenError(); }
    return g;
  }
  async update(u: AuthUser, id: string, dto: Row) {
    const g = await this.own(u, id);
    if (dto.weight !== undefined) await this.assertWeight(g.employee_id, g.cycle_id, dto.weight, id);
    const patch: Row = { title: dto.title, description: dto.description, type: dto.type, cycle_id: dto.cycleId, target_date: dto.targetDate, weight: dto.weight, progress: dto.progress, status: dto.status };
    if (dto.progress === 100 && !dto.status) patch.status = 'COMPLETED'; else if (dto.progress > 0 && g.status === 'NOT_STARTED' && !dto.status) patch.status = 'IN_PROGRESS';
    await this.goals.update(id, patch); await audit(this.db, undefined, 'Goal', id, 'UPDATED', undefined, dto);
    return toDto(await this.goals.getById(id));
  }
  async remove(u: AuthUser, id: string) { await this.own(u, id); await this.goals.remove(id); }

  async addKeyResult(u: AuthUser, goalId: string, dto: Row) {
    const g = await this.own(u, goalId); if (g.type !== 'OKR') throw new BusinessRuleError('Key results apply to OKR goals only');
    const kr = await this.krs.insert({ goal_id: goalId, description: dto.description, target_value: dto.targetValue, current_value: dto.currentValue, unit: dto.unit ?? null });
    await this.rollup(goalId); return toDto(kr);
  }
  async updateKeyResult(u: AuthUser, goalId: string, krId: string, dto: Row) {
    await this.own(u, goalId);
    if (!(await this.krs.findOne({ id: krId, goal_id: goalId }))) throw new NotFoundError('Key result', krId);
    await this.krs.update(krId, { current_value: dto.currentValue, description: dto.description, target_value: dto.targetValue }); await this.rollup(goalId);
    return toDto(await this.krs.getById(krId));
  }
  /** OKR progress = average attainment of its key results. */
  private async rollup(goalId: string): Promise<void> {
    const krs = await this.krs.findAll({ goal_id: goalId });
    if (!krs.length) return;
    const pct = Math.min(100, Math.round(krs.reduce((a, k) => a + Math.min(1, Number(k.current_value) / Number(k.target_value)), 0) / krs.length * 100));
    await this.goals.update(goalId, { progress: pct, status: pct >= 100 ? 'COMPLETED' : pct > 0 ? 'IN_PROGRESS' : 'NOT_STARTED' });
  }

  async giveFeedback(u: AuthUser, dto: Row) {
    if (!u.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    if (dto.toEmployeeId === u.employeeId) throw new ValidationError('You cannot give feedback to yourself');
    const target = await this.employees.findById(dto.toEmployeeId); if (!target) throw new NotFoundError('Employee', dto.toEmployeeId);
    if (dto.type === 'MANAGER' && target.manager_id !== u.employeeId) throw new ForbiddenError('Manager feedback can only be given to your direct reports');
    return toDto(await this.feedback.insert({ from_employee_id: u.employeeId, to_employee_id: dto.toEmployeeId, type: dto.type, comment: dto.comment, rating: dto.rating ?? null, review_id: dto.reviewId ?? null }));
  }
  async feedbackFor(u: AuthUser, employeeId: string) {
    await this.canSee(u, employeeId);
    const rows = await this.feedback.findAll({ to_employee_id: employeeId }, { by: 'created_at', dir: 'DESC' });
    // peer feedback is shown to the subject without the author's identity
    return toDtos(rows.map((r) => (r.type === 'PEER' && employeeId === u.employeeId ? { ...r, from_employee_id: null } : r)));
  }
  async avgRating(employeeId: string) { return round2(Number(await this.db.scalar<number>('SELECT COALESCE(AVG(rating),0) FROM feedback WHERE to_employee_id = ? AND rating IS NOT NULL', [employeeId]))); }
}
