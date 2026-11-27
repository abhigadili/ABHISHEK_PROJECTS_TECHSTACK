import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z, zId, zMonth } from '@hr/common';
import { AttendanceController } from '../controllers/attendance.controller';
import {
  assignShiftDto, checkInDto, checkOutDto, correctionDto, decisionDto, monthQuery, recordsQuery, rejectDto, requestListQuery, shiftDto, syncHolidaysDto, teamQuery, wfhDto,
} from '../dto/attendance.dto';
import { AttendanceService } from '../services/attendance.service';
import { CorrectionService } from '../services/correction.service';
import { ShiftService } from '../services/shift.service';

export function attendanceRoutes(r: Router, db: Db): void {
  const att = new AttendanceService(db);
  const c = new AttendanceController(att, new CorrectionService(db, att), new ShiftService(db));
  const self = requirePermission('SELF_SERVICE');
  const approve = requirePermission('ATTENDANCE_APPROVE', 'ATTENDANCE_MANAGE');
  const manage = requirePermission('ATTENDANCE_MANAGE');

  r.post('/attendance/check-in', self, validate({ body: checkInDto }), h(c.checkIn));
  r.post('/attendance/check-out', self, validate({ body: checkOutDto }), h(c.checkOut));
  r.get('/attendance/today', h(c.today));
  r.get('/attendance/records', validate({ query: recordsQuery }), h(c.list));
  r.get('/attendance/monthly', validate({ query: monthQuery }), h(c.monthly));
  r.get('/attendance/calendar', validate({ query: monthQuery }), h(c.calendar));
  r.get('/attendance/team', approve, validate({ query: teamQuery }), h(c.team));
  r.get('/attendance/payroll-input', requirePermission('ATTENDANCE_MANAGE', 'PAYROLL_PROCESS'), validate({ query: z.object({ employeeId: zId, month: zMonth }) }), h(c.payrollInput));
  r.post('/attendance/missing-punches/mark', manage, h(c.markMissing));

  r.post('/attendance/corrections', self, validate({ body: correctionDto }), h(c.requestCorrection));
  r.get('/attendance/corrections', validate({ query: requestListQuery }), h(c.listCorrections));
  r.post('/attendance/corrections/:id/approve', approve, validate({ params: idParam, body: decisionDto }), h(c.approveCorrection));
  r.post('/attendance/corrections/:id/reject', approve, validate({ params: idParam, body: rejectDto }), h(c.rejectCorrection));
  r.post('/attendance/corrections/:id/cancel', validate({ params: idParam }), h(c.cancelCorrection));

  r.post('/attendance/wfh', self, validate({ body: wfhDto }), h(c.requestWfh));
  r.get('/attendance/wfh', validate({ query: requestListQuery }), h(c.listWfh));
  r.post('/attendance/wfh/:id/approve', approve, validate({ params: idParam, body: decisionDto }), h(c.approveWfh));
  r.post('/attendance/wfh/:id/reject', approve, validate({ params: idParam, body: rejectDto }), h(c.rejectWfh));
  r.post('/attendance/wfh/:id/cancel', validate({ params: idParam }), h(c.cancelWfh));

  r.get('/attendance/shifts', h(c.listShifts));
  r.post('/attendance/shifts', manage, validate({ body: shiftDto }), h(c.createShift));
  r.put('/attendance/shifts/:id', manage, validate({ params: idParam, body: shiftDto.innerType().partial() as any }), h(c.updateShift));
  r.delete('/attendance/shifts/:id', manage, validate({ params: idParam }), h(c.deleteShift));
  r.post('/attendance/shift-assignments', manage, validate({ body: assignShiftDto }), h(c.assignShift));
  r.get('/attendance/shift-assignments/:employeeId', manage, validate({ params: z.object({ employeeId: zId }) }), h(c.employeeShifts));
  r.post('/attendance/holidays/sync', manage, validate({ body: syncHolidaysDto }), h(c.syncHolidays));
}
