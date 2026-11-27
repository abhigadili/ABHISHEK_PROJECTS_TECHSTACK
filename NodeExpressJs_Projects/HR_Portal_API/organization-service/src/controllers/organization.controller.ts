import type { Request, Response } from 'express';
import { created, noContent, ok } from '@hr/common';
import type { ReferenceKind } from '../dto/organization.dto';
import type { OrgStructureService, ReferenceService } from '../services/organization.service';
import { ManagerAssignmentService } from '../services/manager-assignment.service';

export class ReferenceController {
  constructor(private readonly svc: ReferenceService) {}
  list = (k: ReferenceKind) => async (req: Request, res: Response) => ok(res, await this.svc.list(k, req.valid.query));
  get = (k: ReferenceKind) => async (req: Request, res: Response) => ok(res, await this.svc.get(k, req.params.id));
  create = (k: ReferenceKind) => async (req: Request, res: Response) => created(res, await this.svc.create(k, req.valid.body));
  update = (k: ReferenceKind) => async (req: Request, res: Response) => ok(res, await this.svc.update(k, req.params.id, req.valid.body));
  remove = (k: ReferenceKind) => async (req: Request, res: Response) => { await this.svc.remove(k, req.params.id); noContent(res); };
}

export class StructureController {
  constructor(private readonly svc: OrgStructureService, private readonly assign: ManagerAssignmentService) {}
  chart = async (req: Request, res: Response) => ok(res, await this.svc.chart(req.valid.query.type, req.valid.query.rootId, req.valid.query.depth));
  departmentEmployees = async (req: Request, res: Response) => ok(res, await this.svc.departmentEmployees(req.params.id, Number(req.query.page ?? 0), Math.min(200, Number(req.query.size ?? 50))));
  chain = async (req: Request, res: Response) => ok(res, await this.svc.reportingChain(req.params.id));
  subordinates = async (req: Request, res: Response) => ok(res, await this.svc.subordinates(req.params.id));
  directReports = async (req: Request, res: Response) => ok(res, await this.svc.directReports(req.params.id));
  history = async (req: Request, res: Response) => ok(res, await this.svc.reportingHistory(req.params.id));
  details = async (req: Request, res: Response) => ok(res, await this.svc.details(req.params.id));
  assignManager = async (req: Request, res: Response) => ok(res, await this.assign.assign(req.params.id, req.valid.body.managerId, req.valid.body.effectiveFrom));
}
