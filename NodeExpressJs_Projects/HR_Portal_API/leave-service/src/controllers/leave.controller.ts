import type { Request, Response } from 'express';
import { ForbiddenError, created, noContent, ok, today } from '@hr/common';
import type { BalanceService } from '../services/balance.service';
import type { LeaveAdminService } from '../services/leave-admin.service';
import type { LeaveApplicationService } from '../services/leave-application.service';

export class LeaveController {
  constructor(private readonly apps: LeaveApplicationService, private readonly bal: BalanceService, private readonly admin: LeaveAdminService) {}
  private year = (req: Request): number => Number(req.valid.query?.year ?? today().slice(0, 4));

  apply = async (req: Request, res: Response) => created(res, await this.apps.apply(req.valid.body, req.user!));
  list = async (req: Request, res: Response) => ok(res, await this.apps.list(req.valid.query, req.user!));
  get = async (req: Request, res: Response) => ok(res, await this.apps.get(req.params.id, req.user!));
  update = async (req: Request, res: Response) => ok(res, await this.apps.update(req.params.id, req.valid.body, req.user!));
  approve = async (req: Request, res: Response) => ok(res, await this.apps.approve(req.params.id, req.valid.body?.comment, req.user!));
  reject = async (req: Request, res: Response) => ok(res, await this.apps.reject(req.params.id, req.valid.body.comment, req.user!));
  withdraw = async (req: Request, res: Response) => ok(res, await this.apps.withdraw(req.params.id, req.user!));
  requestCancel = async (req: Request, res: Response) => ok(res, await this.apps.requestCancellation(req.params.id, req.valid.body.reason, req.user!));
  approveCancel = async (req: Request, res: Response) => ok(res, await this.apps.decideCancellation(req.params.id, true, req.valid.body?.comment, req.user!));
  rejectCancel = async (req: Request, res: Response) => ok(res, await this.apps.decideCancellation(req.params.id, false, req.valid.body?.comment, req.user!));
  comment = async (req: Request, res: Response) => created(res, await this.apps.addComment(req.params.id, req.valid.body.comment, req.user!));
  attach = async (req: Request, res: Response) => created(res, await this.apps.addAttachment(req.params.id, req.valid.body.documentId, req.valid.body.fileName, req.user!));
  pending = async (req: Request, res: Response) => ok(res, await this.apps.pendingApprovals(req.user!));
  calendar = async (req: Request, res: Response) => ok(res, await this.apps.calendar(req.valid.query.from, req.valid.query.to, req.valid.query.employeeId && req.valid.query.employeeId !== req.user!.employeeId ? this.guard(req) : req.user!.employeeId!));
  teamCalendar = async (req: Request, res: Response) => ok(res, await this.apps.teamCalendar(req.valid.query.from, req.valid.query.to, req.user!));
  upcoming = async (req: Request, res: Response) => ok(res, await this.apps.upcoming(req.user!));
  private guard(req: Request): string { if (!req.user!.roles.some((r) => ['HR_ADMIN', 'SUPER_ADMIN'].includes(r))) throw new ForbiddenError(); return req.valid.query.employeeId; }
  monthly = async (req: Request, res: Response) => ok(res, await this.apps.monthlySummary(req.params.employeeId, req.params.month));
  overview = async (req: Request, res: Response) => ok(res, await this.apps.overview(req.user!.employeeId ?? '', this.year(req)));

  myBalances = async (req: Request, res: Response) => ok(res, await this.bal.forEmployee(req.user!.employeeId ?? '', this.year(req)));
  balances = async (req: Request, res: Response) => { this.bal.assertCanRead(req.user!, req.params.employeeId); ok(res, await this.bal.forEmployee(req.params.employeeId, this.year(req))); };
  balanceHistory = async (req: Request, res: Response) => { this.bal.assertCanRead(req.user!, req.params.employeeId); ok(res, await this.bal.history(req.params.employeeId, req.valid.query?.year)); };
  reconcile = async (req: Request, res: Response) => ok(res, await this.bal.reconcile(req.params.employeeId, this.year(req)));
  adjust = async (req: Request, res: Response) => ok(res, await this.bal.adjust(req.valid.body, req.user!.username));
  encash = async (req: Request, res: Response) => ok(res, await this.bal.encash(req.valid.body, req.user!.username));
  accrual = async (req: Request, res: Response) => ok(res, await this.bal.runAccrual(req.valid.body.year, req.valid.body.month, req.user!.username));
  carryForward = async (req: Request, res: Response) => ok(res, await this.bal.carryForward(req.valid.body.year, req.user!.username));

  listTypes = async (_req: Request, res: Response) => ok(res, await this.admin.listTypes());
  getType = async (req: Request, res: Response) => ok(res, await this.admin.getType(req.params.id));
  createType = async (req: Request, res: Response) => created(res, await this.admin.createType(req.valid.body));
  updateType = async (req: Request, res: Response) => ok(res, await this.admin.updateType(req.params.id, req.valid.body));
  deleteType = async (req: Request, res: Response) => { await this.admin.deleteType(req.params.id); noContent(res); };
  listPolicies = async (_req: Request, res: Response) => ok(res, await this.admin.listPolicies());
  getPolicy = async (req: Request, res: Response) => ok(res, await this.admin.getPolicy(req.params.id));
  createPolicy = async (req: Request, res: Response) => created(res, await this.admin.createPolicy(req.valid.body));
  updatePolicy = async (req: Request, res: Response) => ok(res, await this.admin.updatePolicy(req.params.id, req.valid.body));
  deletePolicy = async (req: Request, res: Response) => { await this.admin.deletePolicy(req.params.id); noContent(res); };
}
