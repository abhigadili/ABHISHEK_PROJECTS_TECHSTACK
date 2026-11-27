import { Db, Repository, Row } from '@hr/common';

export class FormRepository extends Repository {
  constructor(db: Db) { super(db, 'evaluation_forms', { softDelete: true }); }
}
export class QuestionRepository extends Repository {
  constructor(db: Db) { super(db, 'form_questions'); }
  forForm(formId: string): Promise<Row[]> { return this.db.query('SELECT * FROM form_questions WHERE form_id = ? ORDER BY order_no', [formId]); }
}
export class CycleRepository extends Repository { constructor(db: Db) { super(db, 'review_cycles', { sortable: ['period_start', 'created_at', 'status'] }); } }
export class ReviewRepository extends Repository {
  constructor(db: Db) { super(db, 'performance_reviews', { searchable: ['employee_name'], sortable: ['created_at', 'status', 'final_rating', 'employee_name'] }); }
  async statsForCycle(cycleId: string): Promise<{ byStatus: Row[]; ratings: Row | null; byDepartment: Row[] }> {
    const [byStatus, ratings, byDepartment] = await Promise.all([
      this.db.query('SELECT status, COUNT(*) AS reviews FROM performance_reviews WHERE cycle_id = ? GROUP BY status', [cycleId]),
      this.db.one('SELECT AVG(self_rating) AS avg_self, AVG(manager_rating) AS avg_manager, AVG(final_rating) AS avg_final FROM performance_reviews WHERE cycle_id = ?', [cycleId]),
      this.db.query(`SELECT pe.department_id, COUNT(*) AS reviews, AVG(r.final_rating) AS avg_final FROM performance_reviews r LEFT JOIN perf_employees pe ON pe.employee_id = r.employee_id WHERE r.cycle_id = ? GROUP BY pe.department_id`, [cycleId]),
    ]);
    return { byStatus, ratings, byDepartment };
  }
  async distribution(cycleId: string): Promise<Row[]> {
    return this.db.query('SELECT FLOOR(final_rating) AS bucket, COUNT(*) AS employees FROM performance_reviews WHERE cycle_id = ? AND final_rating IS NOT NULL GROUP BY FLOOR(final_rating) ORDER BY bucket', [cycleId]);
  }
}
export class AnswerRepository extends Repository {
  constructor(db: Db) { super(db, 'review_answers'); }
  forReview(reviewId: string): Promise<Row[]> { return this.db.query('SELECT * FROM review_answers WHERE review_id = ?', [reviewId]); }
  async save(reviewId: string, respondent: 'SELF' | 'MANAGER', a: { questionId: string; rating?: number; answerText?: string }, conn: any): Promise<void> {
    const existing = await this.db.one<Row>('SELECT id FROM review_answers WHERE review_id = ? AND question_id = ? AND respondent = ?', [reviewId, a.questionId, respondent], conn);
    const data = { rating: a.rating ?? null, answer_text: a.answerText ?? null };
    if (existing) await this.update(existing.id, data, conn); else await this.insert({ review_id: reviewId, question_id: a.questionId, respondent, ...data }, conn);
  }
}
export class HistoryRepository extends Repository {
  constructor(db: Db) { super(db, 'review_history'); }
  add(conn: any, reviewId: string, action: string, status: string, comment?: string) { return this.insert({ review_id: reviewId, action, status, comment: comment ?? null }, conn); }
}
export class GoalRepository extends Repository { constructor(db: Db) { super(db, 'goals', { softDelete: true }); } }
export class KeyResultRepository extends Repository { constructor(db: Db) { super(db, 'key_results'); } }
export class FeedbackRepository extends Repository { constructor(db: Db) { super(db, 'feedback'); } }
export class PerfEmployeeRepository extends Repository { constructor(db: Db) { super(db, 'perf_employees', { pk: ['employee_id'] }); } }
