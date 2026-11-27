import type { Request, Response } from 'express';
import { ok } from '@hr/common';
import type { ReportingService } from '../services/reporting.service';

export class ReportingController {
  constructor(private readonly svc: ReportingService) {}
  summary = async (req: Request, res: Response) => ok(res, await this.svc.summary(req.user!));
  headcount = async (req: Request, res: Response) => ok(res, await this.svc.headcount(req.user!, req.valid.query));
  leave = async (req: Request, res: Response) => ok(res, await this.svc.leave(req.user!, req.valid.query));
  attendance = async (req: Request, res: Response) => ok(res, await this.svc.attendance(req.user!, req.valid.query.month));
  payroll = async (req: Request, res: Response) => ok(res, await this.svc.payroll(req.user!, req.valid.query.month));
  tax = async (req: Request, res: Response) => ok(res, await this.svc.tax(req.user!, req.valid.query.financialYear));
  projects = async (req: Request, res: Response) => ok(res, await this.svc.projectAllocation(req.user!, req.valid.query.status));
  timesheets = async (req: Request, res: Response) => ok(res, await this.svc.timesheets(req.user!, req.valid.query));
  performance = async (req: Request, res: Response) => ok(res, await this.svc.performance(req.user!, req.query.cycleId as string | undefined));
  exits = async (req: Request, res: Response) => ok(res, await this.svc.exits(req.user!, req.valid.query));
  export = async (req: Request, res: Response) => {
    const f = await this.svc.exportStream(req.user!, req.params.report as 'employees' | 'leave' | 'exits');
    res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-disposition', `attachment; filename="${f.fileName}"`);
    f.stream.on('error', () => res.destroy()); f.stream.pipe(res);
  };
}
