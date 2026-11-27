import { Db, Repository, Row } from '@hr/common';

export class HolidayRepository extends Repository {
  constructor(db: Db) { super(db, 'holidays', { softDelete: true, searchable: ['name'] }); }

  /** Holidays applicable to a location/department: unscoped holidays apply to everyone. */
  async applicable(f: { from?: string; to?: string; year?: number; locationId?: string; departmentId?: string; type?: string }, limit = 500): Promise<Row[]> {
    const where = ['h.deleted = 0']; const params: unknown[] = [];
    if (f.year) { where.push('h.holiday_year = ?'); params.push(f.year); }
    if (f.from) { where.push('h.holiday_date >= ?'); params.push(f.from); }
    if (f.to) { where.push('h.holiday_date <= ?'); params.push(f.to); }
    if (f.type) { where.push('h.type = ?'); params.push(f.type); }
    where.push(`(NOT EXISTS (SELECT 1 FROM holiday_scopes s WHERE s.holiday_id = h.id)
       OR EXISTS (SELECT 1 FROM holiday_scopes s WHERE s.holiday_id = h.id AND ((s.scope_type = 'LOCATION' AND s.scope_id = ?) OR (s.scope_type = 'DEPARTMENT' AND s.scope_id = ?))))`);
    params.push(f.locationId ?? '', f.departmentId ?? '');
    return this.db.query(`SELECT h.* FROM holidays h WHERE ${where.join(' AND ')} ORDER BY h.holiday_date, h.name LIMIT ?`, [...params, limit]);
  }

  scopes(holidayIds: string[]): Promise<Row[]> {
    if (!holidayIds.length) return Promise.resolve([]);
    return this.db.query(`SELECT * FROM holiday_scopes WHERE holiday_id IN (${holidayIds.map(() => '?').join(',')})`, holidayIds);
  }
  setScopes(holidayId: string, locationIds: string[], departmentIds: string[], conn: any): Promise<unknown[]> {
    return this.db.exec('DELETE FROM holiday_scopes WHERE holiday_id = ?', [holidayId], conn).then(() => Promise.all([
      ...locationIds.map((id) => this.db.exec('INSERT INTO holiday_scopes (holiday_id, scope_id, scope_type) VALUES (?,?,?)', [holidayId, id, 'LOCATION'], conn)),
      ...departmentIds.map((id) => this.db.exec('INSERT INTO holiday_scopes (holiday_id, scope_id, scope_type) VALUES (?,?,?)', [holidayId, id, 'DEPARTMENT'], conn)),
    ]));
  }
  duplicate(date: string, name: string, excludeId?: string): Promise<Row | null> {
    return this.db.one('SELECT id FROM holidays WHERE deleted = 0 AND holiday_date = ? AND name = ? AND id <> ? LIMIT 1', [date, name, excludeId ?? '']);
  }
}

export class HolidayYearRepository extends Repository {
  constructor(db: Db) { super(db, 'holiday_years'); }
  forDate(date: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM holiday_years WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY year_number DESC LIMIT 1', [date, date]);
  }
}
