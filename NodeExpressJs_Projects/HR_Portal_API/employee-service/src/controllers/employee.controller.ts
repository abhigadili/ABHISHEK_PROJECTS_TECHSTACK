import type { Request, Response } from 'express';
import { created, noContent, ok } from '@hr/common';
import type { SubResource } from '../dto/employee.dto';
import type { EmployeeService } from '../services/employee.service';

export class EmployeeController {
  constructor(private readonly svc: EmployeeService) {}
  onboard = async (req: Request, res: Response) => created(res, await this.svc.onboard(req.valid.body));
  directory = async (req: Request, res: Response) => ok(res, await this.svc.directory(req.valid.query));
  me = async (req: Request, res: Response) => ok(res, await this.svc.profile(req.user!.employeeId ?? '', req.user!));
  profile = async (req: Request, res: Response) => ok(res, await this.svc.profile(req.params.id, req.user!));
  summary = async (req: Request, res: Response) => ok(res, await this.svc.summary(req.params.id));
  team = async (req: Request, res: Response) => ok(res, await this.svc.team(req.params.id));
  update = async (req: Request, res: Response) => ok(res, await this.svc.update(req.params.id, req.valid.body, req.user!));
  status = async (req: Request, res: Response) => ok(res, await this.svc.changeStatus(req.params.id, req.valid.body.status, req.valid.body.reason, req.valid.body.exitDate));
  remove = async (req: Request, res: Response) => { await this.svc.remove(req.params.id); noContent(res); };
  employmentHistory = async (req: Request, res: Response) => ok(res, await this.svc.employmentHistory(req.params.id, req.user!));
  profileChanges = async (req: Request, res: Response) => ok(res, await this.svc.profileChanges(req.params.id));
  statusHistory = async (req: Request, res: Response) => ok(res, await this.svc.statusHistory(req.params.id));
  headcount = async (_req: Request, res: Response) => ok(res, await this.svc.headcountByDepartment());
  listSub = (kind: SubResource) => async (req: Request, res: Response) => ok(res, await this.svc.listSub(req.params.id, kind, req.user!));
  addSub = (kind: SubResource) => async (req: Request, res: Response) => created(res, await this.svc.addSub(req.params.id, kind, req.body, req.user!));
  updateSub = (kind: SubResource) => async (req: Request, res: Response) => ok(res, await this.svc.updateSub(req.params.id, kind, req.params.subId, req.body, req.user!));
  deleteSub = (kind: SubResource) => async (req: Request, res: Response) => { await this.svc.deleteSub(req.params.id, kind, req.params.subId, req.user!); noContent(res); };
}
