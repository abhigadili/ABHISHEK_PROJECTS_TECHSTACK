import type { Request, Response } from 'express';
import { created, noContent, ok } from '@hr/common';
import type { HolidayService } from '../services/holiday.service';

export class HolidayController {
  constructor(private readonly svc: HolidayService) {}
  list = async (req: Request, res: Response) => ok(res, await this.svc.list(req.valid.query));
  calendar = async (req: Request, res: Response) => ok(res, await this.svc.calendar(req.valid.query));
  upcoming = async (req: Request, res: Response) => ok(res, await this.svc.upcoming(req.valid.query));
  count = async (req: Request, res: Response) => ok(res, await this.svc.count(req.valid.query));
  get = async (req: Request, res: Response) => ok(res, await this.svc.get(req.params.id));
  create = async (req: Request, res: Response) => created(res, await this.svc.create(req.valid.body));
  update = async (req: Request, res: Response) => ok(res, await this.svc.update(req.params.id, req.valid.body));
  remove = async (req: Request, res: Response) => { await this.svc.remove(req.params.id); noContent(res); };
  listYears = async (_req: Request, res: Response) => ok(res, await this.svc.listYears());
  createYear = async (req: Request, res: Response) => created(res, await this.svc.createYear(req.valid.body));
  updateYear = async (req: Request, res: Response) => ok(res, await this.svc.updateYear(req.params.id, req.valid.body));
}
