import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z, zId } from '@hr/common';
import { TimesheetController } from '../controllers/timesheet.controller';
import { decisionDto, listQuery, rangeQuery, rejectDto, reopenDto, saveWeekDto, taskDto, weekParam } from '../dto/timesheet.dto';
import { TimesheetService } from '../services/timesheet.service';

export function timesheetRoutes(r: Router, db: Db): void {
  const c = new TimesheetController(new TimesheetService(db));
  const approve = requirePermission('TIMESHEET_APPROVE'); const self = requirePermission('SELF_SERVICE');
  const proj = z.object({ projectId: zId });

  r.get('/timesheets', validate({ query: listQuery }), h(c.list));
  r.get('/timesheets/pending-approvals', approve, h(c.pending));
  r.get('/timesheets/week/:weekStart', validate({ params: weekParam }), h(c.myWeek));
  r.put('/timesheets/week/:weekStart', self, validate({ params: weekParam, body: saveWeekDto }), h(c.saveWeek));
  r.get('/timesheets/employee/:employeeId/week/:weekStart', validate({ params: z.object({ employeeId: zId, weekStart: weekParam.shape.weekStart }) }), h(c.employeeWeek));
  r.get('/timesheets/reports/employee-hours', validate({ query: rangeQuery }), h(c.employeeSummary));
  r.get('/timesheets/reports/project-hours/:projectId', validate({ params: proj, query: rangeQuery }), h(c.projectSummary));
  r.get('/timesheets/projects/:projectId/tasks', validate({ params: proj }), h(c.listTasks));
  r.post('/timesheets/projects/:projectId/tasks', requirePermission('PROJECT_MANAGE'), validate({ params: proj, body: taskDto }), h(c.createTask));
  r.put('/timesheets/tasks/:id', requirePermission('PROJECT_MANAGE'), validate({ params: idParam, body: taskDto.partial() }), h(c.updateTask));
  r.delete('/timesheets/entries/:entryId', self, validate({ params: z.object({ entryId: zId }) }), h(c.deleteEntry));
  r.get('/timesheets/:id', validate({ params: idParam }), h(c.get));
  r.post('/timesheets/:id/submit', self, validate({ params: idParam }), h(c.submit));
  r.post('/timesheets/:id/approve', approve, validate({ params: idParam, body: decisionDto }), h(c.approve));
  r.post('/timesheets/:id/reject', approve, validate({ params: idParam, body: rejectDto }), h(c.reject));
  r.post('/timesheets/:id/reopen', validate({ params: idParam, body: reopenDto }), h(c.reopen));
}
