import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, audit, buildEvent, cache, enqueueOutbox, hasPermission, key, minutesBetween,
  monthRange, toDto, toDtos, toDtoPage, pageRequest, eachDay, isWeekend, today, groupBy, sum, aggregateInWorker,
} from '@hr/common';
import { attendanceConfig, fromOffice, officeDate, officeMinuteOfDay, timeToMinutes } from '../config';
import {
  CalendarRepository, EmployeeSnapshotRepository, RecordRepository, ShiftRepository, WfhRepository,
} from '../repositories/attendance.repository';

const RECORD_FIELDS = ['id', 'employeeId', 'workDate', 'checkIn', 'checkOut', 'status', 'workMode', 'shiftId', 'workedMinutes', 'lateMinutes', 'earlyDepartureMinutes', 'overtimeMinutes', 'source', 'remarks'];

export class AttendanceService {
  readonly records: RecordRepository;
  readonly shifts: ShiftRepository;
  readonly calendar: CalendarRepository;
  private readonly wfh: WfhRepository;
  private readonly employees: EmployeeSnapshotRepository;

  constructor(private readonly db: Db) {
    this.records = new RecordRepository(db); this.shifts = new ShiftRepository(db); this.calendar = new CalendarRepository(db);
    this.wfh = new WfhRepository(db); this.employees = new EmployeeSnapshotRepository(db);
  }

  private requireEmployee(user: AuthUser): string {
    if (!user.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    return user.employeeId;
  }

  async shiftFor(employeeId: string, date: string): Promise<Row> {
    const s = (await this.shifts.forEmployee(employeeId, date)) ?? (await this.shifts.defaultShift());
    if (!s) throw new BusinessRuleError('No shift is configured');
    return s;
  }

  /** Derives status/late/early/overtime from the shift rules (all minutes are office wall-clock). */
  async evaluate(shift: Row, checkIn: Date, checkOut: Date | null, date: string): Promise<{ worked: number; late: number; early: number; overtime: number; status: string }> {
    const start = timeToMinutes(shift.start_time); const end = timeToMinutes(shift.end_time);
    const late = Math.max(0, officeMinuteOfDay(checkIn) - start - shift.grace_minutes > 0 ? officeMinuteOfDay(checkIn) - start : 0);
    if (!checkOut) return { worked: 0, late, early: 0, overtime: 0, status: 'PRESENT' };
    const worked = minutesBetween(checkIn, checkOut);
    const early = Math.max(0, end - officeMinuteOfDay(checkOut));
    const overtime = await this.records.overtime(worked, shift.standard_minutes, shift.overtime_threshold_minutes);
    const status = worked >= shift.full_day_minutes ? 'PRESENT' : worked >= shift.half_day_minutes ? 'HALF_DAY' : 'ABSENT';
    void date;
    return { worked, late, early: worked >= shift.full_day_minutes ? early : early, overtime, status };
  }

  async checkIn(user: AuthUser, workMode: 'OFFICE' | 'WFH', remarks?: string) {
    const employeeId = this.requireEmployee(user);
    const emp = await this.employees.findById(employeeId);
    if (!emp || !['ACTIVE', 'ON_NOTICE'].includes(emp.status)) throw new BusinessRuleError('Only active employees can check in');
    const now = new Date(); const date = officeDate(now);
    if (await this.calendar.isOnLeave(employeeId, date)) throw new ConflictError('You are on approved leave today');
    if (workMode === 'WFH' && !(await this.wfh.approvedCovering(employeeId, date))) throw new BusinessRuleError('No approved work-from-home request covers today');
    const shift = await this.shiftFor(employeeId, date);
    const holiday = await this.calendar.isHoliday(date, emp.location_id);
    const result = await this.db.tx(async (conn) => {
      const existing = await this.records.forDay(employeeId, date, conn, true);
      if (existing?.check_in) throw new ConflictError('You have already checked in today');
      const ev = await this.evaluate(shift, now, null, date);
      const row = existing
        ? (await this.records.update(existing.id, { check_in: now, status: 'PRESENT', work_mode: workMode, late_minutes: ev.late, shift_id: shift.id, remarks: remarks ?? holiday?.name ?? null }, conn), { ...existing, check_in: now })
        : await this.records.insert({ employee_id: employeeId, work_date: date, check_in: now, status: 'PRESENT', work_mode: workMode, source: 'WEB', shift_id: shift.id, late_minutes: ev.late, early_departure_minutes: 0, overtime_minutes: 0, worked_minutes: 0, remarks: remarks ?? (holiday ? `Worked on holiday: ${holiday.name}` : null), version: 0 }, conn);
      await enqueueOutbox(this.db, conn, Topics.ATTENDANCE_CHECKED_IN, buildEvent(Topics.ATTENDANCE_CHECKED_IN, 'attendance-service', { employeeId, workDate: date, checkIn: now.toISOString(), workMode, lateMinutes: ev.late }, employeeId));
      return row;
    });
    await this.evictSummary(employeeId);
    return this.dayView(await this.records.getById(result.id, 'Attendance record'));
  }

  async checkOut(user: AuthUser, remarks?: string) {
    const employeeId = this.requireEmployee(user);
    const now = new Date(); const date = officeDate(now);
    const rec = await this.db.tx(async (conn) => {
      const r = await this.records.forDay(employeeId, date, conn, true);
      if (!r?.check_in) throw new BusinessRuleError('You have not checked in today');
      if (r.check_out) throw new ConflictError('You have already checked out today');
      const shift = r.shift_id ? await this.shifts.findById(r.shift_id, conn) ?? await this.shiftFor(employeeId, date) : await this.shiftFor(employeeId, date);
      const ev = await this.evaluate(shift, new Date(r.check_in), now, date);
      await this.records.update(r.id, { check_out: now, worked_minutes: ev.worked, late_minutes: ev.late, early_departure_minutes: ev.early, overtime_minutes: ev.overtime, status: ev.status, remarks: remarks ?? r.remarks }, conn);
      await enqueueOutbox(this.db, conn, Topics.ATTENDANCE_CHECKED_OUT, buildEvent(Topics.ATTENDANCE_CHECKED_OUT, 'attendance-service', { employeeId, workDate: date, checkOut: now.toISOString(), workedMinutes: ev.worked, overtimeMinutes: ev.overtime, status: ev.status }, employeeId));
      return r;
    });
    await this.evictSummary(employeeId);
    return this.dayView(await this.records.getById(rec.id, 'Attendance record'));
  }

  private dayView(r: Row) { return toDto(r, RECORD_FIELDS); }

  /** Today's attendance with shift/holiday/leave context. */
  async today(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const date = officeDate();
    const emp = await this.employees.findById(employeeId);
    const [rec, holiday, leave, shift] = await Promise.all([this.records.forDay(employeeId, date), this.calendar.isHoliday(date, emp?.location_id ?? null), this.calendar.isOnLeave(employeeId, date), this.shiftFor(employeeId, date).catch(() => null)]);
    return { date, record: rec ? this.dayView(rec) : null, holiday: holiday ? toDto(holiday) : null, onLeave: !!leave, shift: shift ? toDto(shift, ['id', 'code', 'name', 'startTime', 'endTime', 'weeklyOffs']) : null, weekend: isWeekend(date) };
  }

  async list(q: Row, viewer: AuthUser) {
    const employeeId = await this.authorizedEmployee(viewer, q.employeeId);
    const where: Row = { employee_id: employeeId };
    if (q.status) where.status = q.status;
    if (q.from) where.work_date = { op: '>=', value: q.from };
    const page = await this.records.page(where, pageRequest({ ...q, sort: q.sort ?? 'work_date' }));
    return toDtoPage(page, RECORD_FIELDS);
  }

  /** Self, or the employee's manager, or HR. */
  async authorizedEmployee(viewer: AuthUser, requested?: string): Promise<string> {
    const target = requested ?? viewer.employeeId;
    if (!target) throw new ForbiddenError('Your account is not linked to an employee');
    if (target === viewer.employeeId || hasPermission(viewer, 'ATTENDANCE_MANAGE')) return target;
    const emp = await this.employees.findById(target);
    if (emp?.manager_id && emp.manager_id === viewer.employeeId) return target;
    throw new ForbiddenError('You may only view your own or your team\'s attendance');
  }

  // ------------------------------------------------------------------ monthly summary
  /** Runs the existing stored procedure (upsert into monthly_attendance_summary) and reads the view. */
  async monthly(viewer: AuthUser, month: string | undefined, requested?: string, refresh = false) {
    const employeeId = await this.authorizedEmployee(viewer, requested);
    const m = month ?? today().slice(0, 7); const [y, mo] = m.split('-').map(Number);
    const k = key('att', 'summary', employeeId, m);
    if (!refresh) { const hit = await cache.get<any>(k); if (hit) return hit; }
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new NotFoundError('Employee', employeeId);
    await this.calendar.runSummary(employeeId, y, mo, emp.location_id);
    const sum = await this.calendar.summary(employeeId, y, mo);
    const out = { employeeId, month: m, summary: toDto(sum), records: toDtos(await this.records.range(employeeId, ...(Object.values(monthRange(m)) as [string, string])), RECORD_FIELDS) };
    await cache.set(k, out, attendanceConfig.summaryTtl);
    return out;
  }

  /** Per-day calendar: attendance record, holiday, approved leave and weekly-off flags (computed concurrently). */
  async employeeCalendar(viewer: AuthUser, month: string | undefined, requested?: string) {
    const employeeId = await this.authorizedEmployee(viewer, requested);
    const m = month ?? today().slice(0, 7); const { from, to } = monthRange(m);
    const emp = await this.employees.findById(employeeId);
    const [recs, hols, leaves, shift] = await Promise.all([this.records.range(employeeId, from, to), this.calendar.holidays(from, to, emp?.location_id ?? null), this.calendar.leaveDays(employeeId, from, to), this.shiftFor(employeeId, from)]);
    const byDate = new Map(recs.map((r) => [r.work_date as string, r])); const hol = new Map(hols.map((h) => [h.holiday_date as string, h])); const leave = new Set(leaves.map((l) => l.leave_date as string));
    const offs = String(shift.weekly_offs).split(',');
    const names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return [...eachDay(from, to)].map((d) => {
      const r = byDate.get(d); const dow = names[new Date(`${d}T00:00:00Z`).getUTCDay()];
      const type = r ? r.status : hol.has(d) ? 'HOLIDAY' : offs.includes(dow) ? 'WEEKLY_OFF' : leave.has(d) ? 'LEAVE' : d < today() ? 'ABSENT' : 'UPCOMING';
      return { date: d, type, holiday: hol.get(d)?.name ?? null, checkIn: r?.check_in ?? null, checkOut: r?.check_out ?? null, workedMinutes: r?.worked_minutes ?? 0, workMode: r?.work_mode ?? null };
    });
  }

  /** Manager/HR team report: per-employee attendance for a day, plus a worker-thread aggregation for month totals. */
  async teamReport(viewer: AuthUser, month?: string, date?: string) {
    const hr = hasPermission(viewer, 'ATTENDANCE_MANAGE');
    const team = hr ? await this.employees.findAll({ status: ['ACTIVE', 'ON_NOTICE'] }, undefined, 2000) : await this.employees.findAll({ manager_id: viewer.employeeId ?? '-' }, undefined, 500);
    const day = date ?? officeDate(); const m = month ?? day.slice(0, 7); const { from, to } = monthRange(m);
    const ids = team.map((t) => t.employee_id as string);
    const [dayRecs, monthRecs] = await Promise.all([
      this.records.teamDay(ids, day),
      ids.length ? this.db.query(`SELECT employee_id, status, worked_minutes, late_minutes, overtime_minutes FROM attendance_records WHERE work_date BETWEEN ? AND ? AND employee_id IN (${ids.map(() => '?').join(',')})`, [from, to, ...ids]) : Promise.resolve([]),
    ]);
    const byEmp = new Map(dayRecs.map((r) => [r.employee_id as string, r]));
    const totals = monthRecs.length > 500 ? await aggregateInWorker(monthRecs, ['employee_id'], ['worked_minutes', 'late_minutes', 'overtime_minutes'])
      : [...groupBy(monthRecs, (r: Row) => r.employee_id as string).entries()].map(([employee_id, rs]) => ({ employee_id, count: rs.length, worked_minutes: sum(rs.map((r) => r.worked_minutes)), late_minutes: sum(rs.map((r) => r.late_minutes)), overtime_minutes: sum(rs.map((r) => r.overtime_minutes)) }));
    const tot = new Map(totals.map((t: any) => [t.employee_id as string, t]));
    const members = team.map((t) => {
      const r = byEmp.get(t.employee_id);
      return { employeeId: t.employee_id, fullName: t.full_name, today: r ? { status: r.status, checkIn: r.check_in, checkOut: r.check_out, workMode: r.work_mode } : { status: 'NOT_CHECKED_IN' }, month: toDto(tot.get(t.employee_id) ?? { count: 0, worked_minutes: 0, late_minutes: 0, overtime_minutes: 0 }) };
    });
    return { date: day, month: m, headcount: members.length, present: members.filter((x) => x.today.status === 'PRESENT' || x.today.status === 'HALF_DAY').length, members };
  }

  /** Input for payroll: refreshes the stored-procedure summary and returns the figures payroll needs. */
  async payrollInput(employeeId: string, month: string) {
    const [y, mo] = month.split('-').map(Number);
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new NotFoundError('Employee', employeeId);
    await this.calendar.runSummary(employeeId, y, mo, emp.location_id);
    const s = await this.calendar.summary(employeeId, y, mo);
    return { employeeId, month, workingDays: s?.working_days ?? 0, presentDays: s?.present_days ?? 0, halfDays: s?.half_days ?? 0, absentDays: s?.absent_days ?? 0, leaveDays: s?.leave_days ?? 0, holidays: s?.holidays ?? 0, overtimeMinutes: s?.overtime_minutes ?? 0 };
  }

  // ------------------------------------------------------------------ maintenance
  /** Past days with a check-in but no check-out are flagged MISSING_PUNCH (scheduled + manual endpoint). */
  async markMissingPunches(): Promise<number> {
    const open = await this.records.openBefore(officeDate());
    for (const r of open) {
      await this.records.update(r.id, { status: 'MISSING_PUNCH' });
      await audit(this.db, undefined, 'AttendanceRecord', r.id, 'MISSING_PUNCH_FLAGGED');
    }
    return open.length;
  }

  /** Called when a correction is approved: rewrites the day with the requested punches. */
  async applyCorrection(employeeId: string, workDate: string, checkIn: Date, checkOut: Date, conn: any): Promise<Row> {
    const shift = await this.shiftFor(employeeId, workDate);
    const ev = await this.evaluate(shift, checkIn, checkOut, workDate);
    const existing = await this.records.forDay(employeeId, workDate, conn, true);
    const patch = { check_in: checkIn, check_out: checkOut, worked_minutes: ev.worked, late_minutes: ev.late, early_departure_minutes: ev.early, overtime_minutes: ev.overtime, status: ev.status, source: 'CORRECTION', shift_id: shift.id };
    if (existing) { await this.records.update(existing.id, patch, conn); return { ...existing, ...patch }; }
    return this.records.insert({ employee_id: employeeId, work_date: workDate, work_mode: 'OFFICE', version: 0, ...patch }, conn);
  }

  async evictSummary(employeeId: string): Promise<void> { await cache.evictPrefix(key('att', 'summary', employeeId)); }
  fromOfficeTime = fromOffice;
  validateDate(d: string): void { if (d > today()) throw new ValidationError('Date cannot be in the future'); }
}
