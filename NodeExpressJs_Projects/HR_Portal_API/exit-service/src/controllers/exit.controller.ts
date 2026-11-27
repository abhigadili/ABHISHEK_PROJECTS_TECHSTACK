import type { Request, Response } from 'express';
import { created, ok } from '@hr/common';
import type { ExitTasksService } from '../services/exit-tasks.service';
import type { ResignationService } from '../services/resignation.service';
import type { SettlementService } from '../services/settlement.service';

export class ExitController {
  constructor(private readonly core: ResignationService, private readonly tasks: ExitTasksService, private readonly settle: SettlementService) {}
  submit = async (req: Request, res: Response) => created(res, await this.core.submit(req.user!, req.valid.body));
  list = async (req: Request, res: Response) => ok(res, await this.core.list(req.user!, req.valid.query));
  mine = async (req: Request, res: Response) => ok(res, await this.core.mine(req.user!));
  get = async (req: Request, res: Response) => ok(res, await this.core.get(req.params.id, req.user!));
  managerApprove = async (req: Request, res: Response) => ok(res, await this.core.managerDecision(req.user!, req.params.id, true, req.valid.body?.comment));
  managerReject = async (req: Request, res: Response) => ok(res, await this.core.managerDecision(req.user!, req.params.id, false, req.valid.body.comment));
  hrConfirm = async (req: Request, res: Response) => ok(res, await this.core.hrConfirm(req.user!, req.params.id, req.valid.body));
  withdraw = async (req: Request, res: Response) => ok(res, await this.core.withdraw(req.user!, req.params.id, req.valid.body?.reason));
  policyGet = async (_q: Request, res: Response) => ok(res, await this.core.policyGet());
  policyUpdate = async (req: Request, res: Response) => ok(res, await this.core.policyUpdate(req.valid.body));

  listTasks = async (req: Request, res: Response) => ok(res, await this.tasks.list(req.params.id, req.user!));
  addTask = async (req: Request, res: Response) => created(res, await this.tasks.addTask(req.params.id, req.valid.body, req.user!));
  completeTask = async (req: Request, res: Response) => ok(res, await this.tasks.complete(req.params.id, req.params.taskId, req.valid.body, req.user!));
  listForms = async (_q: Request, res: Response) => ok(res, await this.tasks.listForms());
  createForm = async (req: Request, res: Response) => created(res, await this.tasks.createForm(req.valid.body));
  updateForm = async (req: Request, res: Response) => ok(res, await this.tasks.updateForm(req.params.id, req.valid.body));
  schedule = async (req: Request, res: Response) => created(res, await this.tasks.schedule(req.params.id, req.valid.body, req.user!));
  completeInterview = async (req: Request, res: Response) => ok(res, await this.tasks.completeInterview(req.params.id, req.valid.body, req.user!));

  calculate = async (req: Request, res: Response) => ok(res, await this.settle.calculate(req.params.id, req.user!));
  addLine = async (req: Request, res: Response) => created(res, await this.settle.addLine(req.params.id, req.valid.body, req.user!));
  settlement = async (req: Request, res: Response) => ok(res, await this.settle.view(req.params.id, req.user!));
  processSettlement = async (req: Request, res: Response) => ok(res, await this.settle.process(req.params.id, req.valid.body?.paymentReference, req.user!));
}
