import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, Row, Topics, audit, buildEvent, enqueueOutbox, hasPermission, pageRequest, toDto, toDtoPage, toDtos, today, addDays, ValidationError,
} from '@hr/common';
import { officeDate } from '../config';
import { CorrectionRepository, EmployeeSnapshotRepository, WfhRepository } from '../repositories/attendance.repository';
import type { AttendanceService } from './attendance.service';

const CORRECTION_WINDOW_DAYS = 31;

export class CorrectionService {
  private readonly corrections: CorrectionRepository;
  private readonly wfh: WfhRepository;
  private readonly employees: EmployeeSnapshotRepository;
  constructor(private readonly db: Db, private readonly attendance: AttendanceService) {
    this.corrections = new CorrectionRepository(db); this.wfh = new WfhRepository(db); this.employees = new EmployeeSnapshotRepository(db);
  }

  private canDecide(user: AuthUser, req: Row): boolean {
    if (req.employee_id === user.employeeId) return false;
    return req.manager_id === user.employeeId || hasPermission(user, 'ATTENDANCE_MANAGE');
  }

  // ------------------------------------------------------------------ corrections / regularization
  async requestCorrection(user: AuthUser, dto: Row) {
    if (!user.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    if (dto.workDate > officeDate()) throw new ValidationError('Cannot correct a future date');
    if (dto.workDate < addDays(today(), -CORRECTION_WINDOW_DAYS)) throw new BusinessRuleError(`Corrections are only allowed for the last ${CORRECTION_WINDOW_DAYS} days`);
    const emp = await this.employees.getById(user.employeeId, 'Employee');
    const dup = await this.corrections.findOne({ employee_id: user.employeeId, work_date: dto.workDate, status: 'PENDING' });
    if (dup) throw new ConflictError('A correction request for this date is already pending');
    const row = await this.db.tx(async (conn) => {
      const r = await this.corrections.insert({
        employee_id: user.employeeId, employee_name: emp.full_name, manager_id: emp.manager_id ?? null, work_date: dto.workDate, requested_check_in: new Date(dto.requestedCheckIn),
        requested_check_out: new Date(dto.requestedCheckOut), reason: dto.reason, status: 'PENDING', escalated: emp.manager_id ? 0 : 1,
      }, conn);
      await audit(this.db, conn, 'AttendanceCorrection', r.id, 'REQUESTED', undefined, { workDate: dto.workDate });
      return r;
    });
    return toDto(row);
  }

  listCorrections(viewer: AuthUser, q: Row) {
    const where: Row = {};
    if (q.status) where.status = q.status;
    if (hasPermission(viewer, 'ATTENDANCE_MANAGE')) { if (q.employeeId) where.employee_id = q.employeeId; }
    else if (hasPermission(viewer, 'ATTENDANCE_APPROVE') && !q.employeeId) where.manager_id = viewer.employeeId ?? '-';
    else where.employee_id = viewer.employeeId ?? '-';
    return this.corrections.page(where, pageRequest(q)).then((p) => toDtoPage(p));
  }

  async decideCorrection(user: AuthUser, id: string, approve: boolean, comment?: string) {
    const req = await this.corrections.getById(id, 'Correction request');
    if (req.status !== 'PENDING') throw new BusinessRuleError(`Request is already ${req.status}`);
    if (!this.canDecide(user, req)) throw new ForbiddenError('You are not the approver of this request');
    await this.db.tx(async (conn) => {
      await this.corrections.update(id, { status: approve ? 'APPROVED' : 'REJECTED', reviewer_id: user.userId, reviewed_at: new Date(), review_comment: comment ?? null }, conn);
      if (approve) {
        await this.attendance.applyCorrection(req.employee_id, req.work_date, new Date(req.requested_check_in), new Date(req.requested_check_out), conn);
        await enqueueOutbox(this.db, conn, Topics.ATTENDANCE_CORRECTED, buildEvent(Topics.ATTENDANCE_CORRECTED, 'attendance-service', { employeeId: req.employee_id, workDate: req.work_date, requestId: id, decision: 'APPROVED' }, req.employee_id));
      } else {
        await enqueueOutbox(this.db, conn, Topics.ATTENDANCE_CORRECTED, buildEvent(Topics.ATTENDANCE_CORRECTED, 'attendance-service', { employeeId: req.employee_id, workDate: req.work_date, requestId: id, decision: 'REJECTED', comment }, req.employee_id));
      }
      await audit(this.db, conn, 'AttendanceCorrection', id, approve ? 'APPROVED' : 'REJECTED', undefined, { comment });
    });
    await this.attendance.evictSummary(req.employee_id);
    return toDto(await this.corrections.getById(id));
  }

  async cancelCorrection(user: AuthUser, id: string) {
    const req = await this.corrections.getById(id, 'Correction request');
    if (req.employee_id !== user.employeeId) throw new ForbiddenError();
    if (req.status !== 'PENDING') throw new BusinessRuleError('Only pending requests can be cancelled');
    await this.corrections.update(id, { status: 'CANCELLED' });
    return toDto(await this.corrections.getById(id));
  }

  // ------------------------------------------------------------------ work from home
  async requestWfh(user: AuthUser, dto: Row) {
    if (!user.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    const emp = await this.employees.getById(user.employeeId, 'Employee');
    const overlap = await this.db.one("SELECT id FROM wfh_requests WHERE employee_id = ? AND status IN ('PENDING','APPROVED') AND from_date <= ? AND to_date >= ? LIMIT 1", [user.employeeId, dto.toDate, dto.fromDate]);
    if (overlap) throw new ConflictError('A work-from-home request already covers part of this range');
    const r = await this.wfh.insert({ employee_id: user.employeeId, employee_name: emp.full_name, manager_id: emp.manager_id ?? null, from_date: dto.fromDate, to_date: dto.toDate, reason: dto.reason, status: 'PENDING' });
    await audit(this.db, undefined, 'WfhRequest', r.id, 'REQUESTED', undefined, dto);
    return toDto(r);
  }
  listWfh(viewer: AuthUser, q: Row) {
    const where: Row = {};
    if (q.status) where.status = q.status;
    if (hasPermission(viewer, 'ATTENDANCE_MANAGE')) { if (q.employeeId) where.employee_id = q.employeeId; }
    else if (hasPermission(viewer, 'ATTENDANCE_APPROVE') && !q.employeeId) where.manager_id = viewer.employeeId ?? '-';
    else where.employee_id = viewer.employeeId ?? '-';
    return this.wfh.page(where, pageRequest(q)).then((p) => toDtoPage(p));
  }
  async decideWfh(user: AuthUser, id: string, approve: boolean, comment?: string) {
    const req = await this.wfh.getById(id, 'WFH request');
    if (req.status !== 'PENDING') throw new BusinessRuleError(`Request is already ${req.status}`);
    if (!this.canDecide(user, req)) throw new ForbiddenError('You are not the approver of this request');
    await this.wfh.update(id, { status: approve ? 'APPROVED' : 'REJECTED', reviewer_id: user.userId, reviewed_at: new Date(), review_comment: comment ?? null });
    await audit(this.db, undefined, 'WfhRequest', id, approve ? 'APPROVED' : 'REJECTED', undefined, { comment });
    return toDto(await this.wfh.getById(id));
  }
  async cancelWfh(user: AuthUser, id: string) {
    const req = await this.wfh.getById(id, 'WFH request');
    if (req.employee_id !== user.employeeId) throw new ForbiddenError();
    if (!['PENDING', 'APPROVED'].includes(req.status) || req.to_date < today()) throw new BusinessRuleError('This request can no longer be cancelled');
    await this.wfh.update(id, { status: 'CANCELLED' });
    return toDto(await this.wfh.getById(id));
  }
}
void toDtos;
