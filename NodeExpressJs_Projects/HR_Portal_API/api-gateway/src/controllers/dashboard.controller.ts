import type { Request, Response } from 'express';
import { ok } from '@hr/common';
import type { DashboardService } from '../services/dashboard.service';

export class DashboardController {
  constructor(private readonly svc: DashboardService) {}
  employee = async (req: Request, res: Response) => ok(res, await this.svc.employee(req.user!));
  manager = async (req: Request, res: Response) => ok(res, await this.svc.manager(req.user!));
}
