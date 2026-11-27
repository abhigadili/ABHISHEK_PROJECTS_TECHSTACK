import { ConflictError, Db, BusinessRuleError, Row, audit, toColumns, toDto, toDtos } from '@hr/common';
import { HolidayClient } from '../clients/holiday.client';
import { CalendarRepository, ShiftAssignmentRepository, ShiftRepository } from '../repositories/attendance.repository';

export class ShiftService {
  private readonly shifts: ShiftRepository;
  private readonly assignments: ShiftAssignmentRepository;
  private readonly calendar: CalendarRepository;
  private readonly holidays = new HolidayClient();
  constructor(private readonly db: Db) { this.shifts = new ShiftRepository(db); this.assignments = new ShiftAssignmentRepository(db); this.calendar = new CalendarRepository(db); }

  private row(dto: Row): Row { const r = toColumns(dto); for (const f of ['is_default', 'active']) if (f in r) r[f] = r[f] ? 1 : 0; return r; }
  list() { return this.shifts.findAll({}, { by: 'name' }).then((r) => toDtos(r)); }
  async create(dto: Row) {
    if (await this.shifts.findOne({ code: dto.code })) throw new ConflictError('Shift code already exists');
    const s = await this.db.tx(async (conn) => {
      if (dto.isDefault) await this.db.exec('UPDATE shifts SET is_default = 0', [], conn);
      const r = await this.shifts.insert(this.row(dto), conn);
      await audit(this.db, conn, 'Shift', r.id, 'CREATED', undefined, dto);
      return r;
    });
    return toDto(s);
  }
  async update(id: string, dto: Row) {
    const before = await this.shifts.getById(id, 'Shift');
    await this.db.tx(async (conn) => {
      if (dto.isDefault) await this.db.exec('UPDATE shifts SET is_default = 0', [], conn);
      await this.shifts.update(id, this.row(dto), conn);
      await audit(this.db, conn, 'Shift', id, 'UPDATED', toDto(before), dto);
    });
    return toDto(await this.shifts.getById(id));
  }
  async remove(id: string) {
    const s = await this.shifts.getById(id, 'Shift');
    if (s.is_default) throw new BusinessRuleError('The default shift cannot be deleted');
    const used = await this.db.scalar<number>('SELECT COUNT(*) FROM shift_assignments WHERE shift_id = ? AND (effective_to IS NULL OR effective_to >= CURDATE())', [id]);
    if (Number(used) > 0) throw new BusinessRuleError('Shift still has active assignments');
    await this.shifts.remove(id);
  }
  async assign(dto: { employeeIds: string[]; shiftId: string; effectiveFrom: string; effectiveTo?: string }) {
    await this.shifts.getById(dto.shiftId, 'Shift');
    await this.db.tx(async (conn) => {
      for (const emp of dto.employeeIds) {
        for (const o of await this.assignments.overlapping(emp, dto.effectiveFrom, dto.effectiveTo ?? null, conn)) {
          // close overlapping assignments the day before the new one starts (history is preserved)
          const close = new Date(`${dto.effectiveFrom}T00:00:00Z`); close.setUTCDate(close.getUTCDate() - 1);
          await this.assignments.update(o.id, { effective_to: close.toISOString().slice(0, 10) }, conn);
        }
        await this.assignments.insert({ employee_id: emp, shift_id: dto.shiftId, effective_from: dto.effectiveFrom, effective_to: dto.effectiveTo ?? null }, conn);
      }
      await audit(this.db, conn, 'Shift', dto.shiftId, 'ASSIGNED', undefined, dto);
    });
    return { assigned: dto.employeeIds.length };
  }
  assignments_(employeeId: string) { return this.assignments.findAll({ employee_id: employeeId }, { by: 'effective_from', dir: 'DESC' }).then((r) => toDtos(r)); }

  /** Pull holidays from the Holiday Service into the local holiday_snapshots used by the summary procedure. */
  async syncHolidays(year: number) {
    const items = await this.holidays.forYear(year);
    let n = 0;
    for (const h of items) {
      if (h.type !== 'MANDATORY') continue;
      const locs = h.locationIds.length ? h.locationIds : [null];
      for (const loc of locs) { await this.calendar.upsertHoliday({ holiday_id: loc ? `${h.id}:${loc}`.slice(0, 36) : h.id, holiday_date: h.holidayDate, location_id: loc, name: h.name }); n++; }
    }
    return { year, synced: n };
  }
}
