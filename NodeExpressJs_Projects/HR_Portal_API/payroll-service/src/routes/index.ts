import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z, zId } from '@hr/common';
import { PayrollController } from '../controllers/payroll.controller';
import {
  adjustmentDto, assignSalaryDto, settlementPostDto, componentDto, configDto, decisionDto, entryListQuery, loanDto, payslipListQuery, rejectDto, revisionDto, runDto, runListQuery, structureDto,
} from '../dto/payroll.dto';
import { AdjustmentService } from '../services/adjustment.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayslipService } from '../services/payslip.service';
import { SalaryService } from '../services/salary.service';

export function payrollRoutes(r: Router, db: Db): void {
  const salary = new SalaryService(db); const payslips = new PayslipService(db);
  const c = new PayrollController(salary, new PayrollRunService(db, salary, payslips), payslips, new AdjustmentService(db));
  const salaryMgr = requirePermission('SALARY_MANAGE');
  const process = requirePermission('PAYROLL_PROCESS');
  const approve = requirePermission('PAYROLL_APPROVE');
  const view = requirePermission('PAYROLL_VIEW');
  const empParam = z.object({ employeeId: zId });

  r.get('/payroll/config', view, h(c.listConfig));
  r.put('/payroll/config', salaryMgr, validate({ body: configDto }), h(c.updateConfig));
  r.get('/payroll/components', view, h(c.listComponents));
  r.post('/payroll/components', salaryMgr, validate({ body: componentDto }), h(c.createComponent));
  r.put('/payroll/components/:id', salaryMgr, validate({ params: idParam, body: componentDto.partial() }), h(c.updateComponent));
  r.get('/payroll/structures', view, h(c.listStructures));
  r.get('/payroll/structures/:id', view, validate({ params: idParam }), h(c.getStructure));
  r.post('/payroll/structures', salaryMgr, validate({ body: structureDto }), h(c.createStructure));
  r.put('/payroll/structures/:id', salaryMgr, validate({ params: idParam, body: structureDto.partial() }), h(c.updateStructure));

  r.post('/payroll/salaries', salaryMgr, validate({ body: assignSalaryDto }), h(c.assign));
  r.get('/payroll/salaries/me', h(c.mySalary));
  r.get('/payroll/salaries/employee/:employeeId', validate({ params: empParam }), h(c.employeeSalary));
  r.get('/payroll/settlement-basis/:employeeId', requirePermission('EXIT_MANAGE', 'PAYROLL_PROCESS'), validate({ params: empParam }), h(c.settlementBasis));
  r.post('/payroll/settlements', requirePermission('PAYROLL_PROCESS'), validate({ body: settlementPostDto }), h(c.postSettlement));
  r.post('/payroll/revisions', salaryMgr, validate({ body: revisionDto }), h(c.requestRevision));
  r.get('/payroll/revisions', view, h(c.listRevisions));
  r.post('/payroll/revisions/:id/approve', approve, validate({ params: idParam, body: decisionDto }), h(c.approveRevision));
  r.post('/payroll/revisions/:id/reject', approve, validate({ params: idParam, body: rejectDto }), h(c.rejectRevision));

  r.post('/payroll/adjustments', process, validate({ body: adjustmentDto }), h(c.createAdjustment));
  r.get('/payroll/adjustments', view, h(c.listAdjustments));
  r.delete('/payroll/adjustments/:id', process, validate({ params: idParam }), h(c.cancelAdjustment));
  r.post('/payroll/loans', process, validate({ body: loanDto }), h(c.createLoan));
  r.get('/payroll/loans', view, h(c.listLoans));
  r.post('/payroll/loans/:id/close', process, validate({ params: idParam }), h(c.closeLoan));

  r.post('/payroll/runs', process, validate({ body: runDto }), h(c.createRun));
  r.get('/payroll/runs', view, validate({ query: runListQuery }), h(c.listRuns));
  r.get('/payroll/runs/:id', view, validate({ params: idParam }), h(c.getRun));
  r.post('/payroll/runs/:id/calculate', process, validate({ params: idParam }), h(c.calculate));
  r.post('/payroll/runs/:id/process', process, validate({ params: idParam }), h(c.process));
  r.post('/payroll/runs/:id/approve', approve, validate({ params: idParam }), h(c.approveRun));
  r.post('/payroll/runs/:id/finalize', requirePermission('PAYROLL_PROCESS', 'PAYROLL_APPROVE'), validate({ params: idParam }), h(c.finalize));
  r.get('/payroll/runs/:id/entries', view, validate({ params: idParam, query: entryListQuery }), h(c.entries));
  r.get('/payroll/runs/:id/entries/:entryId', view, validate({ params: z.object({ id: zId, entryId: zId }) }), h(c.entry));
  r.get('/payroll/runs/:id/report', view, validate({ params: idParam }), h(c.report));
  r.get('/payroll/employees/:employeeId/history', validate({ params: empParam }), h(c.employeeHistory));

  r.get('/payroll/payslips/me', validate({ query: payslipListQuery }), h(c.myPayslips));
  r.get('/payroll/payslips/me/latest', h(c.latestPayslip));
  r.get('/payroll/payslips/employee/:employeeId', validate({ params: empParam, query: payslipListQuery }), h(c.employeePayslips));
  r.get('/payroll/payslips/:id/download', validate({ params: idParam }), h(c.download));
}
