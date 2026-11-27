import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z, zId } from '@hr/common';
import { PerformanceController } from '../controllers/performance.controller';
import { answersDto, approveDto, cycleDto, feedbackDto, formDto, goalDto, goalListQuery, goalUpdateDto, keyResultDto, keyResultUpdateDto, managerSubmitDto, reviewListQuery, selfSubmitDto } from '../dto/performance.dto';
import { GoalService } from '../services/goal.service';
import { ReviewService } from '../services/review.service';

export function performanceRoutes(r: Router, db: Db): void {
  const c = new PerformanceController(new ReviewService(db), new GoalService(db));
  const manage = requirePermission('PERFORMANCE_MANAGE'); const reviewer = requirePermission('PERFORMANCE_REVIEW', 'PERFORMANCE_MANAGE'); const self = requirePermission('SELF_SERVICE');
  const emp = z.object({ employeeId: zId });

  r.get('/performance/forms', h(c.listForms));
  r.get('/performance/forms/:id', validate({ params: idParam }), h(c.getForm));
  r.post('/performance/forms', manage, validate({ body: formDto }), h(c.createForm));
  r.put('/performance/forms/:id', manage, validate({ params: idParam, body: formDto.innerType().partial() as any }), h(c.updateForm));
  r.get('/performance/cycles', h(c.listCycles));
  r.post('/performance/cycles', manage, validate({ body: cycleDto }), h(c.createCycle));
  r.post('/performance/cycles/:id/activate', manage, validate({ params: idParam }), h(c.activate));
  r.post('/performance/cycles/:id/close', manage, validate({ params: idParam }), h(c.close));
  r.post('/performance/cycles/:id/reminders', manage, validate({ params: idParam }), h(c.reminders));
  r.get('/performance/cycles/:id/report', requirePermission('PERFORMANCE_MANAGE', 'REPORT_VIEW'), validate({ params: idParam }), h(c.cycleReport));

  r.get('/performance/reviews', validate({ query: reviewListQuery }), h(c.list));
  r.get('/performance/reviews/me', h(c.mine));
  r.get('/performance/reviews/employee/:employeeId/history', validate({ params: emp }), h(c.employeeHistory));
  r.get('/performance/reviews/:id', validate({ params: idParam }), h(c.get));
  r.put('/performance/reviews/:id/self', self, validate({ params: idParam, body: answersDto }), h(c.saveSelf));
  r.post('/performance/reviews/:id/self/submit', self, validate({ params: idParam, body: selfSubmitDto }), h(c.submitSelf));
  r.put('/performance/reviews/:id/manager', reviewer, validate({ params: idParam, body: answersDto }), h(c.saveManager));
  r.post('/performance/reviews/:id/manager/submit', reviewer, validate({ params: idParam, body: managerSubmitDto }), h(c.submitManager));
  r.post('/performance/reviews/:id/approve', manage, validate({ params: idParam, body: approveDto }), h(c.approve));

  r.get('/performance/goals', validate({ query: goalListQuery }), h(c.listGoals));
  r.post('/performance/goals', self, validate({ body: goalDto }), h(c.createGoal));
  r.put('/performance/goals/:id', validate({ params: idParam, body: goalUpdateDto }), h(c.updateGoal));
  r.delete('/performance/goals/:id', validate({ params: idParam }), h(c.deleteGoal));
  r.post('/performance/goals/:id/key-results', validate({ params: idParam, body: keyResultDto }), h(c.addKr));
  r.put('/performance/goals/:id/key-results/:krId', validate({ params: z.object({ id: zId, krId: zId }), body: keyResultUpdateDto }), h(c.updateKr));
  r.post('/performance/feedback', self, validate({ body: feedbackDto }), h(c.giveFeedback));
  r.get('/performance/feedback/:employeeId', validate({ params: emp }), h(c.feedbackFor));
}
