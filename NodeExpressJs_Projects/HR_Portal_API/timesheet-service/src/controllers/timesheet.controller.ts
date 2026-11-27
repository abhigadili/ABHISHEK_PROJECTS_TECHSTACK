import type { Request, Response } from 'express';
import { created, noContent, ok, today } from '@hr/common';
import type { TimesheetService } from '../services/timesheet.service';

export class TimesheetController {
  constructor(private readonly svc: TimesheetService) {}
  myWeek = async (req: Request, res: Response) => ok(res, await this.svc.getWeek(req.user!.employeeId ?? '-', req.params.weekStart, req.user!));
  employeeWeek = async (req: Request, res: Response) => ok(res, await this.svc.getWeek(req.params.employeeId, req.params.weekStart, req.user!));
  saveWeek = async (req: Request, res: Response) => ok(res, await this.svc.saveWeek(req.user!, req.params.weekStart, req.valid.body.entries));
  deleteEntry = async (req: Request, res: Response) => ok(res, await this.svc.deleteEntry(req.user!, req.params.entryId));
  submit = async (req: Request, res: Response) => ok(res, await this.svc.submit(req.user!, req.params.id));
  approve = async (req: Request, res: Response) => ok(res, await this.svc.decide(req.user!, req.params.id, true, req.valid.body?.comment));
  reject = async (req: Request, res: Response) => ok(res, await this.svc.decide(req.user!, req.params.id, false, req.valid.body.comment));
  reopen = async (req: Request, res: Response) => ok(res, await this.svc.reopen(req.user!, req.params.id, req.valid.body.reason));
  get = async (req: Request, res: Response) => ok(res, await this.svc.get(req.user!, req.params.id));
  list = async (req: Request, res: Response) => ok(res, await this.svc.list(req.user!, req.valid.query));
  pending = async (req: Request, res: Response) => ok(res, await this.svc.pendingApprovals(req.user!));
  employeeSummary = async (req: Request, res: Response) => ok(res, await this.svc.employeeSummary(req.user!, req.valid.query.employeeId ?? req.user!.employeeId ?? '-', req.valid.query.from, req.valid.query.to));
  projectSummary = async (req: Request, res: Response) => ok(res, await this.svc.projectSummary(req.user!, req.params.projectId, req.valid.query.from, req.valid.query.to));
  listTasks = async (req: Request, res: Response) => ok(res, await this.svc.listTasks(req.params.projectId));
  createTask = async (req: Request, res: Response) => created(res, await this.svc.createTask(req.user!, req.params.projectId, req.valid.body));
  updateTask = async (req: Request, res: Response) => ok(res, await this.svc.updateTask(req.user!, req.params.id, req.valid.body));
  _n = (_r: Request, res: Response) => noContent(res);
  _t = today;
}
