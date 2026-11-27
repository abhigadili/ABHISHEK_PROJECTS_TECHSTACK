import type { Request, Response } from 'express';
import { created, noContent, ok, today } from '@hr/common';
import type { AdjustmentService } from '../services/adjustment.service';
import type { PayrollRunService } from '../services/payroll-run.service';
import type { PayslipService } from '../services/payslip.service';
import type { SalaryService } from '../services/salary.service';

export class PayrollController {
  constructor(private readonly salary: SalaryService, private readonly runs: PayrollRunService, private readonly payslips: PayslipService, private readonly adj: AdjustmentService) {}

  // config / components / structures
  listConfig = async (_q: Request, res: Response) => ok(res, await this.salary.listConfig());
  updateConfig = async (req: Request, res: Response) => ok(res, await this.salary.updateConfig(req.valid.body.items));
  listComponents = async (_q: Request, res: Response) => ok(res, await this.salary.listComponents());
  createComponent = async (req: Request, res: Response) => created(res, await this.salary.createComponent(req.valid.body));
  updateComponent = async (req: Request, res: Response) => ok(res, await this.salary.updateComponent(req.params.id, req.valid.body));
  listStructures = async (_q: Request, res: Response) => ok(res, await this.salary.listStructures());
  getStructure = async (req: Request, res: Response) => ok(res, await this.salary.getStructure(req.params.id));
  createStructure = async (req: Request, res: Response) => created(res, await this.salary.createStructure(req.valid.body));
  updateStructure = async (req: Request, res: Response) => ok(res, await this.salary.updateStructure(req.params.id, req.valid.body));

  // salary
  assign = async (req: Request, res: Response) => created(res, await this.salary.assign(req.valid.body));
  employeeSalary = async (req: Request, res: Response) => ok(res, await this.salary.employeeSalary(req.user!, req.params.employeeId));
  mySalary = async (req: Request, res: Response) => ok(res, await this.salary.employeeSalary(req.user!, req.user!.employeeId ?? ''));
  requestRevision = async (req: Request, res: Response) => created(res, await this.salary.requestRevision(req.valid.body));
  listRevisions = async (req: Request, res: Response) => ok(res, await this.salary.listRevisions(req.query.status as string, req.query.employeeId as string));
  approveRevision = async (req: Request, res: Response) => ok(res, await this.salary.decideRevision(req.params.id, true, req.valid.body?.comment, req.user!));
  rejectRevision = async (req: Request, res: Response) => ok(res, await this.salary.decideRevision(req.params.id, false, req.valid.body?.comment, req.user!));

  // adjustments & loans
  createAdjustment = async (req: Request, res: Response) => created(res, await this.adj.create(req.valid.body));
  listAdjustments = async (req: Request, res: Response) => ok(res, await this.adj.list(req.query.employeeId as string, req.query.month as string));
  cancelAdjustment = async (req: Request, res: Response) => ok(res, await this.adj.cancel(req.params.id));
  createLoan = async (req: Request, res: Response) => created(res, await this.adj.createLoan(req.valid.body));
  listLoans = async (req: Request, res: Response) => ok(res, await this.adj.listLoans(req.query.employeeId as string));
  closeLoan = async (req: Request, res: Response) => ok(res, await this.adj.closeLoan(req.params.id));

  settlementBasis = async (req: Request, res: Response) => ok(res, await this.adj.settlementBasis(req.params.employeeId));
  postSettlement = async (req: Request, res: Response) => created(res, await this.adj.postSettlement(req.valid.body));

  // runs
  createRun = async (req: Request, res: Response) => created(res, await this.runs.create(req.valid.body.month, req.valid.body.note));
  listRuns = async (req: Request, res: Response) => ok(res, await this.runs.list(req.valid.query));
  getRun = async (req: Request, res: Response) => ok(res, await this.runs.get(req.params.id));
  calculate = async (req: Request, res: Response) => ok(res, await this.runs.calculate(req.params.id));
  process = async (req: Request, res: Response) => ok(res, await this.runs.process(req.params.id, req.user!));
  approveRun = async (req: Request, res: Response) => ok(res, await this.runs.approve(req.params.id, req.user!));
  finalize = async (req: Request, res: Response) => ok(res, await this.runs.finalize(req.params.id, req.user!));
  entries = async (req: Request, res: Response) => ok(res, await this.runs.listEntries(req.params.id, req.valid.query));
  entry = async (req: Request, res: Response) => ok(res, await this.runs.entry(req.params.id, req.params.entryId));
  report = async (req: Request, res: Response) => ok(res, await this.runs.report(req.params.id));
  employeeHistory = async (req: Request, res: Response) => { this.salary.assertCanView(req.user!, req.params.employeeId); ok(res, await this.runs.employeeHistory(req.params.employeeId)); };

  // payslips
  myPayslips = async (req: Request, res: Response) => ok(res, await this.payslips.listForEmployee(req.user!, req.user!.employeeId ?? '', req.valid.query?.year));
  employeePayslips = async (req: Request, res: Response) => ok(res, await this.payslips.listForEmployee(req.user!, req.params.employeeId, req.valid.query?.year));
  latestPayslip = async (req: Request, res: Response) => ok(res, await this.payslips.latest(req.user!.employeeId ?? ''));
  download = async (req: Request, res: Response) => {
    const f = await this.payslips.open(req.user!, req.params.id);
    res.setHeader('content-type', 'application/pdf'); res.setHeader('content-length', String(f.sizeBytes));
    res.setHeader('content-disposition', `attachment; filename="${f.fileName}"`);
    f.stream.pipe(res);
  };
  _noop = (_r: Request, res: Response) => noContent(res);
  _today = today;
}
