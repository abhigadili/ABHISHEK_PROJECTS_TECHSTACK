import { Router } from 'express';
import { Db, asyncHandler as h, requirePermission, validate } from '@hr/common';
import { ReportingController } from '../controllers/reporting.controller';
import { cycleQuery, exportParam, fyQuery, monthQuery, periodQuery, projectQuery } from '../dto/reporting.dto';
import { ReportingService } from '../services/reporting.service';

export function reportingRoutes(r: Router, db: Db): void {
  const c = new ReportingController(new ReportingService(db));
  const view = requirePermission('REPORT_VIEW');
  r.get('/reports/summary', view, h(c.summary));
  r.get('/reports/headcount', view, validate({ query: periodQuery }), h(c.headcount));
  r.get('/reports/leave', view, validate({ query: periodQuery }), h(c.leave));
  r.get('/reports/attendance', view, validate({ query: monthQuery }), h(c.attendance));
  r.get('/reports/payroll', view, validate({ query: monthQuery }), h(c.payroll));
  r.get('/reports/tax', view, validate({ query: fyQuery }), h(c.tax));
  r.get('/reports/projects', view, validate({ query: projectQuery }), h(c.projects));
  r.get('/reports/timesheets', view, validate({ query: periodQuery }), h(c.timesheets));
  r.get('/reports/performance', view, validate({ query: cycleQuery.partial() }), h(c.performance));
  r.get('/reports/exits', view, validate({ query: periodQuery }), h(c.exits));
  r.get('/reports/export/:report.csv', view, validate({ params: exportParam }), h(c.export));
}
