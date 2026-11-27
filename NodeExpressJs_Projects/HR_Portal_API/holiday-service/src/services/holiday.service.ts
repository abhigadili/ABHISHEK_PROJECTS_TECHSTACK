import crypto from 'node:crypto';
import { BusinessRuleError, ConflictError, Db, Row, ValidationError, audit, cache, key, toDto, toDtos, groupBy, today, addDays } from '@hr/common';
import { holidayConfig } from '../config';
import { HolidayRepository, HolidayYearRepository } from '../repositories/holiday.repository';

export class HolidayService {
  private readonly holidays: HolidayRepository;
  private readonly years: HolidayYearRepository;
  constructor(private readonly db: Db) { this.holidays = new HolidayRepository(db); this.years = new HolidayYearRepository(db); }

  private async withScopes(rows: Row[]) {
    const scopes = groupBy(await this.holidays.scopes(rows.map((r) => r.id)), (s: Row) => s.holiday_id as string);
    return rows.map((r) => {
      const sc = scopes.get(r.id) ?? [];
      return { ...toDto(r, ['id', 'name', 'holidayDate', 'holidayYear', 'type', 'description']),
        locationIds: sc.filter((s) => s.scope_type === 'LOCATION').map((s) => s.scope_id), departmentIds: sc.filter((s) => s.scope_type === 'DEPARTMENT').map((s) => s.scope_id) };
    });
  }

  list(f: Row) {
    const k = key('holiday', 'list', crypto.createHash('md5').update(JSON.stringify(f)).digest('hex'));
    return cache.getOrLoad(k, holidayConfig.calendarTtl, async () => this.withScopes(await this.holidays.applicable(f)));
  }

  async calendar(f: Row) {
    const year = f.year ?? Number(today().slice(0, 4));
    const items = await this.list({ ...f, year });
    const byMonth = groupBy(items, (h: any) => (h.holidayDate as string).slice(0, 7));
    return { year, months: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, hs]) => ({ month, holidays: hs })), total: items.length };
  }

  async upcoming(f: { locationId?: string; departmentId?: string; limit: number }) {
    const from = today();
    return (await this.list({ from, to: addDays(from, 365), locationId: f.locationId, departmentId: f.departmentId })).slice(0, f.limit);
  }

  /** Mandatory holidays that fall on weekdays between two dates; used by leave/attendance calculations. */
  async count(f: { from: string; to: string; locationId?: string; departmentId?: string }) {
    const rows = await this.holidays.applicable({ ...f, type: 'MANDATORY' });
    const dates = [...new Set(rows.map((r) => r.holiday_date as string))];
    return { from: f.from, to: f.to, count: dates.length, dates };
  }

  async get(id: string) { return (await this.withScopes([await this.holidays.getById(id, 'Holiday')]))[0]; }

  private async validate(date: string, type: string, name: string, excludeId?: string): Promise<number> {
    const year = await this.years.forDate(date);
    if (!year) throw new BusinessRuleError(`No active holiday year configured for ${date}`);
    if (await this.holidays.duplicate(date, name, excludeId)) throw new ConflictError('A holiday with this name already exists on that date');
    void type;
    return year.year_number as number;
  }

  async create(dto: Row) {
    const yearNo = await this.validate(dto.date, dto.type, dto.name);
    const row = await this.db.tx(async (conn) => {
      const h = await this.holidays.insert({ name: dto.name, holiday_date: dto.date, holiday_year: yearNo, type: dto.type, description: dto.description ?? null, deleted: 0 }, conn);
      await this.holidays.setScopes(h.id, dto.locationIds, dto.departmentIds, conn);
      await audit(this.db, conn, 'Holiday', h.id, 'CREATED', undefined, dto);
      return h;
    });
    await this.evict();
    return this.get(row.id);
  }

  async update(id: string, dto: Row) {
    const before = await this.holidays.getById(id, 'Holiday');
    const date = dto.date ?? before.holiday_date; const name = dto.name ?? before.name;
    const yearNo = await this.validate(date, dto.type ?? before.type, name, id);
    await this.db.tx(async (conn) => {
      await this.holidays.update(id, { name, holiday_date: date, holiday_year: yearNo, type: dto.type ?? before.type, description: dto.description ?? before.description }, conn);
      if (dto.locationIds || dto.departmentIds) {
        const existing = await this.holidays.scopes([id]);
        await this.holidays.setScopes(id, dto.locationIds ?? existing.filter((s) => s.scope_type === 'LOCATION').map((s) => s.scope_id), dto.departmentIds ?? existing.filter((s) => s.scope_type === 'DEPARTMENT').map((s) => s.scope_id), conn);
      }
      await audit(this.db, conn, 'Holiday', id, 'UPDATED', toDto(before), dto);
    });
    await this.evict();
    return this.get(id);
  }

  async remove(id: string) {
    const before = await this.holidays.getById(id, 'Holiday');
    await this.db.tx(async (conn) => { await this.holidays.remove(id, conn); await audit(this.db, conn, 'Holiday', id, 'DELETED', toDto(before)); });
    await this.evict();
  }

  // holiday years
  listYears() { return this.years.findAll({}, { by: 'year_number', dir: 'DESC' }).then((r) => toDtos(r)); }
  async createYear(dto: Row) {
    if (await this.years.findOne({ year_number: dto.yearNumber })) throw new ConflictError('Holiday year already exists');
    const r = await this.years.insert({ year_number: dto.yearNumber, start_date: dto.startDate, end_date: dto.endDate, description: dto.description ?? null, active: dto.active ? 1 : 0 });
    await this.evict();
    return toDto(r);
  }
  async updateYear(id: string, dto: Row) {
    const y = await this.years.getById(id, 'Holiday year');
    const start = dto.startDate ?? y.start_date; const end = dto.endDate ?? y.end_date;
    if (end < start) throw new ValidationError('endDate must not precede startDate');
    await this.years.update(id, { start_date: start, end_date: end, description: dto.description ?? y.description, ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}) });
    await this.evict();
    return toDto(await this.years.getById(id));
  }
  private evict() { return cache.evictPrefix(key('holiday')); }
}
