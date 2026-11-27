import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z, zId } from '@hr/common';
import { ExitController } from '../controllers/exit.controller';
import { addTaskDto, completeInterviewDto, completeTaskDto, formDto, hrConfirmDto, listQuery, managerDecisionDto, managerRejectDto, policyDto, processSettlementDto, resignDto, scheduleInterviewDto, settlementLineDto, withdrawDto } from '../dto/exit.dto';
import { ExitTasksService } from '../services/exit-tasks.service';
import { ResignationService } from '../services/resignation.service';
import { SettlementService } from '../services/settlement.service';

export function exitRoutes(r: Router, db: Db): void {
  const core = new ResignationService(db);
  const c = new ExitController(core, new ExitTasksService(db, core), new SettlementService(db, core));
  const self = requirePermission('SELF_SERVICE'); const approve = requirePermission('EXIT_APPROVE', 'EXIT_MANAGE'); const manage = requirePermission('EXIT_MANAGE');
  const task = z.object({ id: zId, taskId: zId });

  r.post('/exit/resignations', self, validate({ body: resignDto }), h(c.submit));
  r.get('/exit/resignations', validate({ query: listQuery }), h(c.list));
  r.get('/exit/resignations/me', h(c.mine));
  r.get('/exit/resignations/:id', validate({ params: idParam }), h(c.get));
  r.post('/exit/resignations/:id/manager-approve', approve, validate({ params: idParam, body: managerDecisionDto }), h(c.managerApprove));
  r.post('/exit/resignations/:id/manager-reject', approve, validate({ params: idParam, body: managerRejectDto }), h(c.managerReject));
  r.post('/exit/resignations/:id/hr-confirm', manage, validate({ params: idParam, body: hrConfirmDto }), h(c.hrConfirm));
  r.post('/exit/resignations/:id/withdraw', self, validate({ params: idParam, body: withdrawDto }), h(c.withdraw));

  r.get('/exit/resignations/:id/tasks', validate({ params: idParam }), h(c.listTasks));
  r.post('/exit/resignations/:id/tasks', manage, validate({ params: idParam, body: addTaskDto }), h(c.addTask));
  r.post('/exit/resignations/:id/tasks/:taskId/complete', validate({ params: task, body: completeTaskDto }), h(c.completeTask));

  r.get('/exit/interview-forms', manage, h(c.listForms));
  r.post('/exit/interview-forms', manage, validate({ body: formDto }), h(c.createForm));
  r.put('/exit/interview-forms/:id', manage, validate({ params: idParam, body: formDto.partial() }), h(c.updateForm));
  r.post('/exit/resignations/:id/interview', manage, validate({ params: idParam, body: scheduleInterviewDto }), h(c.schedule));
  r.post('/exit/resignations/:id/interview/complete', manage, validate({ params: idParam, body: completeInterviewDto }), h(c.completeInterview));

  r.post('/exit/resignations/:id/settlement/calculate', manage, validate({ params: idParam }), h(c.calculate));
  r.post('/exit/resignations/:id/settlement/lines', manage, validate({ params: idParam, body: settlementLineDto }), h(c.addLine));
  r.get('/exit/resignations/:id/settlement', validate({ params: idParam }), h(c.settlement));
  r.post('/exit/resignations/:id/settlement/process', requirePermission('PAYROLL_PROCESS'), validate({ params: idParam, body: processSettlementDto }), h(c.processSettlement));

  r.get('/exit/policy', manage, h(c.policyGet));
  r.put('/exit/policy', manage, validate({ body: policyDto }), h(c.policyUpdate));
}
