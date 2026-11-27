import { Router } from 'express';
import { Db, asyncHandler as h, idempotent, idParam, requirePermission, validate, z, zId, zMonth } from '@hr/common';
import { LeaveController } from '../controllers/leave.controller';
import {
  accrualRunDto, adjustBalanceDto, applyLeaveDto, attachmentRef, balanceQuery, calendarQuery, cancelDto, commentDto, decisionDto, encashDto, leaveListQuery, leaveTypeDto,
  policyDto, rejectDto, updateLeaveDto, yearRunDto,
} from '../dto/leave.dto';
import { BalanceService } from '../services/balance.service';
import { LeaveAdminService } from '../services/leave-admin.service';
import { LeaveApplicationService } from '../services/leave-application.service';

export function buildLeave(db: Db) {
  const bal = new BalanceService(db);
  return { bal, apps: new LeaveApplicationService(db, bal), admin: new LeaveAdminService(db) };
}

export function leaveRoutes(r: Router, db: Db): void {
  const { apps, bal, admin } = buildLeave(db);
  const c = new LeaveController(apps, bal, admin);
  const approve = requirePermission('LEAVE_APPROVE', 'LEAVE_POLICY_MANAGE');
  const hr = requirePermission('LEAVE_POLICY_MANAGE');
  const self = requirePermission('SELF_SERVICE');

  // applications
  r.post('/leaves', self, idempotent('leave-apply'), validate({ body: applyLeaveDto }), h(c.apply));
  r.get('/leaves', validate({ query: leaveListQuery }), h(c.list));
  r.get('/leaves/pending-approvals', approve, h(c.pending));
  r.get('/leaves/calendar', validate({ query: calendarQuery }), h(c.calendar));
  r.get('/leaves/calendar/team', approve, validate({ query: calendarQuery }), h(c.teamCalendar));
  r.get('/leaves/upcoming', approve, h(c.upcoming));
  r.get('/leaves/overview', h(c.overview));
  r.get('/leaves/summary/:employeeId/:month', requirePermission('LEAVE_POLICY_MANAGE', 'PAYROLL_PROCESS'), validate({ params: z.object({ employeeId: zId, month: zMonth }) }), h(c.monthly));
  r.get('/leaves/:id', validate({ params: idParam }), h(c.get));
  r.put('/leaves/:id', validate({ params: idParam, body: updateLeaveDto }), h(c.update));
  r.post('/leaves/:id/approve', approve, validate({ params: idParam, body: decisionDto }), h(c.approve));
  r.post('/leaves/:id/reject', approve, validate({ params: idParam, body: rejectDto }), h(c.reject));
  r.post('/leaves/:id/withdraw', validate({ params: idParam }), h(c.withdraw));
  r.post('/leaves/:id/cancel-request', validate({ params: idParam, body: cancelDto }), h(c.requestCancel));
  r.post('/leaves/:id/cancel-approve', approve, validate({ params: idParam, body: decisionDto }), h(c.approveCancel));
  r.post('/leaves/:id/cancel-reject', approve, validate({ params: idParam, body: decisionDto }), h(c.rejectCancel));
  r.post('/leaves/:id/comments', validate({ params: idParam, body: commentDto }), h(c.comment));
  r.post('/leaves/:id/attachments', validate({ params: idParam, body: attachmentRef }), h(c.attach));

  // balances
  r.get('/leave-balances/me', validate({ query: balanceQuery }), h(c.myBalances));
  r.get('/leave-balances/:employeeId', validate({ query: balanceQuery, params: z.object({ employeeId: zId }) }), h(c.balances));
  r.get('/leave-balances/:employeeId/history', validate({ query: balanceQuery, params: z.object({ employeeId: zId }) }), h(c.balanceHistory));
  r.get('/leave-balances/:employeeId/reconcile', hr, validate({ query: balanceQuery, params: z.object({ employeeId: zId }) }), h(c.reconcile));
  r.post('/leave-balances/adjust', hr, validate({ body: adjustBalanceDto }), h(c.adjust));
  r.post('/leave-balances/encash', hr, validate({ body: encashDto }), h(c.encash));
  r.post('/leave-balances/accrual/run', hr, validate({ body: accrualRunDto }), h(c.accrual));
  r.post('/leave-balances/carry-forward/run', hr, validate({ body: yearRunDto }), h(c.carryForward));

  // configuration
  r.get('/leave-types', h(c.listTypes));
  r.get('/leave-types/:id', validate({ params: idParam }), h(c.getType));
  r.post('/leave-types', hr, validate({ body: leaveTypeDto }), h(c.createType));
  r.put('/leave-types/:id', hr, validate({ params: idParam, body: leaveTypeDto.partial() }), h(c.updateType));
  r.delete('/leave-types/:id', hr, validate({ params: idParam }), h(c.deleteType));
  r.get('/leave-policies', hr, h(c.listPolicies));
  r.get('/leave-policies/:id', hr, validate({ params: idParam }), h(c.getPolicy));
  r.post('/leave-policies', hr, validate({ body: policyDto }), h(c.createPolicy));
  r.put('/leave-policies/:id', hr, validate({ params: idParam, body: policyDto.partial() }), h(c.updatePolicy));
  r.delete('/leave-policies/:id', hr, validate({ params: idParam }), h(c.deletePolicy));
}
