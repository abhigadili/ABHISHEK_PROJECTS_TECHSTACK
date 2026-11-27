import type { Request, Response } from 'express';
import { created, noContent, ok } from '@hr/common';
import type { AttendanceService } from '../services/attendance.service';
import type { CorrectionService } from '../services/correction.service';
import type { ShiftService } from '../services/shift.service';

export class AttendanceController {
  constructor(private readonly att: AttendanceService, private readonly cor: CorrectionService, private readonly shifts: ShiftService) {}
  checkIn = async (req: Request, res: Response) => created(res, await this.att.checkIn(req.user!, req.valid.body.workMode, req.valid.body.remarks));
  checkOut = async (req: Request, res: Response) => ok(res, await this.att.checkOut(req.user!, req.valid.body?.remarks));
  today = async (req: Request, res: Response) => ok(res, await this.att.today(req.user!));
  list = async (req: Request, res: Response) => ok(res, await this.att.list(req.valid.query, req.user!));
  monthly = async (req: Request, res: Response) => ok(res, await this.att.monthly(req.user!, req.valid.query.month, req.valid.query.employeeId, req.valid.query.refresh === 'true'));
  calendar = async (req: Request, res: Response) => ok(res, await this.att.employeeCalendar(req.user!, req.valid.query.month, req.valid.query.employeeId));
  team = async (req: Request, res: Response) => ok(res, await this.att.teamReport(req.user!, req.valid.query.month, req.valid.query.date));
  payrollInput = async (req: Request, res: Response) => ok(res, await this.att.payrollInput(req.valid.query.employeeId, req.valid.query.month));
  markMissing = async (_req: Request, res: Response) => ok(res, { flagged: await this.att.markMissingPunches() });

  requestCorrection = async (req: Request, res: Response) => created(res, await this.cor.requestCorrection(req.user!, req.valid.body));
  listCorrections = async (req: Request, res: Response) => ok(res, await this.cor.listCorrections(req.user!, req.valid.query));
  approveCorrection = async (req: Request, res: Response) => ok(res, await this.cor.decideCorrection(req.user!, req.params.id, true, req.valid.body?.comment));
  rejectCorrection = async (req: Request, res: Response) => ok(res, await this.cor.decideCorrection(req.user!, req.params.id, false, req.valid.body?.comment));
  cancelCorrection = async (req: Request, res: Response) => ok(res, await this.cor.cancelCorrection(req.user!, req.params.id));

  requestWfh = async (req: Request, res: Response) => created(res, await this.cor.requestWfh(req.user!, req.valid.body));
  listWfh = async (req: Request, res: Response) => ok(res, await this.cor.listWfh(req.user!, req.valid.query));
  approveWfh = async (req: Request, res: Response) => ok(res, await this.cor.decideWfh(req.user!, req.params.id, true, req.valid.body?.comment));
  rejectWfh = async (req: Request, res: Response) => ok(res, await this.cor.decideWfh(req.user!, req.params.id, false, req.valid.body?.comment));
  cancelWfh = async (req: Request, res: Response) => ok(res, await this.cor.cancelWfh(req.user!, req.params.id));

  listShifts = async (_req: Request, res: Response) => ok(res, await this.shifts.list());
  createShift = async (req: Request, res: Response) => created(res, await this.shifts.create(req.valid.body));
  updateShift = async (req: Request, res: Response) => ok(res, await this.shifts.update(req.params.id, req.valid.body));
  deleteShift = async (req: Request, res: Response) => { await this.shifts.remove(req.params.id); noContent(res); };
  assignShift = async (req: Request, res: Response) => created(res, await this.shifts.assign(req.valid.body));
  employeeShifts = async (req: Request, res: Response) => ok(res, await this.shifts.assignments_(req.params.employeeId));
  syncHolidays = async (req: Request, res: Response) => ok(res, await this.shifts.syncHolidays(req.valid.body.year));
}
