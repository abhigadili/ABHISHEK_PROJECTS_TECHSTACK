import type { Request, Response } from 'express';
import { created, noContent, ok } from '@hr/common';
import type { GoalService } from '../services/goal.service';
import type { ReviewService } from '../services/review.service';

export class PerformanceController {
  constructor(private readonly rev: ReviewService, private readonly goals: GoalService) {}
  listForms = async (_q: Request, res: Response) => ok(res, await this.rev.listForms());
  getForm = async (req: Request, res: Response) => ok(res, await this.rev.getForm(req.params.id));
  createForm = async (req: Request, res: Response) => created(res, await this.rev.createForm(req.valid.body));
  updateForm = async (req: Request, res: Response) => ok(res, await this.rev.updateForm(req.params.id, req.valid.body));
  listCycles = async (req: Request, res: Response) => ok(res, await this.rev.listCycles(req.query.status as string));
  createCycle = async (req: Request, res: Response) => created(res, await this.rev.createCycle(req.valid.body));
  activate = async (req: Request, res: Response) => ok(res, await this.rev.activateCycle(req.params.id));
  close = async (req: Request, res: Response) => ok(res, await this.rev.closeCycle(req.params.id));
  reminders = async (req: Request, res: Response) => ok(res, await this.rev.sendReminders(req.params.id));
  cycleReport = async (req: Request, res: Response) => ok(res, await this.rev.cycleReport(req.params.id));
  list = async (req: Request, res: Response) => ok(res, await this.rev.list(req.user!, req.valid.query));
  mine = async (req: Request, res: Response) => ok(res, await this.rev.myCurrent(req.user!));
  get = async (req: Request, res: Response) => ok(res, await this.rev.get(req.params.id, req.user!));
  employeeHistory = async (req: Request, res: Response) => ok(res, await this.rev.employeeHistory(req.params.employeeId, req.user!));
  saveSelf = async (req: Request, res: Response) => ok(res, await this.rev.saveSelf(req.params.id, req.valid.body.answers, req.user!));
  submitSelf = async (req: Request, res: Response) => ok(res, await this.rev.submitSelf(req.params.id, req.valid.body, req.user!));
  saveManager = async (req: Request, res: Response) => ok(res, await this.rev.saveManager(req.params.id, req.valid.body.answers, req.user!));
  submitManager = async (req: Request, res: Response) => ok(res, await this.rev.submitManager(req.params.id, req.valid.body, req.user!));
  approve = async (req: Request, res: Response) => ok(res, await this.rev.approve(req.params.id, req.valid.body ?? {}, req.user!));

  listGoals = async (req: Request, res: Response) => ok(res, await this.goals.list(req.user!, req.valid.query));
  createGoal = async (req: Request, res: Response) => created(res, await this.goals.create(req.user!, req.valid.body));
  updateGoal = async (req: Request, res: Response) => ok(res, await this.goals.update(req.user!, req.params.id, req.valid.body));
  deleteGoal = async (req: Request, res: Response) => { await this.goals.remove(req.user!, req.params.id); noContent(res); };
  addKr = async (req: Request, res: Response) => created(res, await this.goals.addKeyResult(req.user!, req.params.id, req.valid.body));
  updateKr = async (req: Request, res: Response) => ok(res, await this.goals.updateKeyResult(req.user!, req.params.id, req.params.krId, req.valid.body));
  giveFeedback = async (req: Request, res: Response) => created(res, await this.goals.giveFeedback(req.user!, req.valid.body));
  feedbackFor = async (req: Request, res: Response) => ok(res, await this.goals.feedbackFor(req.user!, req.params.employeeId));
}
