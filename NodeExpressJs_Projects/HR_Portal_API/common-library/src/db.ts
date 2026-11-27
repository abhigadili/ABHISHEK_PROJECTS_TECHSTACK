import mysql, { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuid } from 'uuid';
import { config } from './config';
import { requestContext } from './context';
import { ConflictError, NotFoundError, ValidationError, AppError } from './errors';
import { logger } from './logger';
import type { Page, PageRequest, Row } from './types';

/** BIT(1) -> boolean, DATE -> 'YYYY-MM-DD' string (no timezone drift), DECIMAL -> number. */
function typeCast(field: any, next: () => any): any {
  if (field.type === 'BIT' && field.length === 1) {
    const b = field.buffer();
    return b === null ? null : b[0] === 1;
  }
  if (field.type === 'DATE') return field.string();
  if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
    const s = field.string();
    return s === null ? null : Number(s);
  }
  if (field.type === 'LONGLONG') {
    const s = field.string();
    return s === null ? null : Number(s);
  }
  return next();
}

export type Queryable = Pick<PoolConnection, 'query' | 'execute'>;

/** Thin wrapper around a mysql2 pool: parameter binding only, transactions, stored procedure calls. */
export class Db {
  readonly pool: Pool;
  constructor(public readonly database: string) {
    const c = config.mysql;
    this.pool = mysql.createPool({
      host: c.host, port: c.port, user: c.user, password: c.password, database,
      waitForConnections: true, connectionLimit: c.poolSize, connectTimeout: c.connectTimeoutMs,
      maxIdle: Math.max(2, Math.floor(c.poolSize / 2)), idleTimeout: 60000, enableKeepAlive: true,
      timezone: 'Z', typeCast, dateStrings: false, decimalNumbers: true, namedPlaceholders: false,
    });
  }

  async query<T = Row>(sql: string, params: unknown[] = [], conn?: Queryable): Promise<T[]> {
    const started = Date.now();
    try {
      const [rows] = await (conn ?? this.pool).query({ sql, timeout: config.mysql.queryTimeoutMs }, params);
      logger.debug({ db: this.database, ms: Date.now() - started, sql: sql.slice(0, 120) }, 'sql');
      return rows as T[];
    } catch (e: any) {
      throw translateDbError(e, sql);
    }
  }

  async one<T = Row>(sql: string, params: unknown[] = [], conn?: Queryable): Promise<T | null> {
    const rows = await this.query<T>(sql, params, conn);
    return rows[0] ?? null;
  }

  async scalar<T = any>(sql: string, params: unknown[] = [], conn?: Queryable): Promise<T | null> {
    const r = await this.one<Row>(sql, params, conn);
    return r ? (Object.values(r)[0] as T) : null;
  }

  async exec(sql: string, params: unknown[] = [], conn?: Queryable): Promise<ResultSetHeader> {
    try {
      const [res] = await (conn ?? this.pool).query({ sql, timeout: config.mysql.queryTimeoutMs }, params);
      return res as ResultSetHeader;
    } catch (e: any) {
      throw translateDbError(e, sql);
    }
  }

  /** Run fn inside a transaction; commits on success, rolls back on any error. */
  async tx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const out = await fn(conn);
      await conn.commit();
      return out;
    } catch (e) {
      await conn.rollback().catch(() => undefined);
      throw e;
    } finally {
      conn.release();
    }
  }

  /** CALL a stored procedure with bound parameters; returns the first result set. */
  async callProcedure<T = Row>(name: string, args: unknown[] = []): Promise<T[]> {
    if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new ValidationError('Illegal procedure name');
    const sql = `CALL ${name}(${args.map(() => '?').join(',')})`;
    try {
      const [res] = await this.pool.query({ sql, timeout: config.mysql.queryTimeoutMs }, args);
      const sets = res as any[];
      return (Array.isArray(sets[0]) ? sets[0] : sets) as T[];
    } catch (e: any) {
      throw translateDbError(e, sql);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /** Fail fast (non-destructively) if the existing Java schema does not contain what the service needs. */
  async requireTables(tables: string[]): Promise<void> {
    const rows = await this.query<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?', [this.database]);
    const have = new Set(rows.map((r: any) => (r.table_name ?? r.TABLE_NAME) as string));
    const missing = tables.filter((t) => !have.has(t));
    if (missing.length) throw new Error(`Database ${this.database} is missing tables: ${missing.join(', ')}`);
  }
}

/** Database errors never leak SQL text or driver messages to clients. */
function translateDbError(e: any, sql: string): Error {
  if (e instanceof AppError) return e;
  logger.error({ code: e.code, errno: e.errno, sqlState: e.sqlState, sql: sql.slice(0, 200), msg: e.sqlMessage }, 'database error');
  if (e.code === 'ER_DUP_ENTRY') return new ConflictError('A record with the same unique value already exists');
  if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_ROW_IS_REFERENCED_2') return new ConflictError('Operation violates a data relationship');
  if (e.code === 'ER_SIGNAL_EXCEPTION' || e.errno === 1644) return new ValidationError(e.sqlMessage ?? 'Rejected by database rule');
  if (e.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || e.code === 'ETIMEDOUT') return new AppError(504, 'DB_TIMEOUT', 'The database did not respond in time');
  return new AppError(500, 'DATABASE_ERROR', 'A database error occurred');
}

// ---------------------------------------------------------------- naming helpers
export const toCamel = (s: string): string => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
export const toSnake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function camelizeRow<T = Row>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

interface ColumnMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  hasDefault: boolean;
  autoIncrement: boolean;
}

export interface RepoOptions {
  pk?: string[];
  /** columns the client may sort by (allowlist); defaults to all real columns */
  sortable?: string[];
  /** columns searched with LIKE for the `q` parameter */
  searchable?: string[];
  softDelete?: boolean;
}

export type Where = Record<string, unknown>;

/**
 * Generic table repository. Column names come from information_schema (never from user input),
 * every value is bound as a parameter, and sort fields are validated against an allowlist.
 */
export class Repository<T extends Row = Row> {
  private cols?: Map<string, ColumnMeta>;
  protected readonly pk: string[];

  constructor(protected readonly db: Db, readonly table: string, protected readonly opts: RepoOptions = {}) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error('Illegal table name');
    this.pk = opts.pk ?? ['id'];
  }

  async columns(): Promise<Map<string, ColumnMeta>> {
    if (!this.cols) {
      const rows = await this.db.query<Row>(
        `SELECT column_name AS name, data_type AS dataType, is_nullable AS nullable, column_default AS dflt, extra
           FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
        [this.db.database, this.table]);
      if (!rows.length) throw new Error(`Table ${this.db.database}.${this.table} does not exist`);
      this.cols = new Map(rows.map((r: any) => {
        const name = r.name ?? r.NAME; const dt = r.dataType ?? r.DATATYPE;
        return [name, {
          name, dataType: dt, nullable: (r.nullable ?? r.NULLABLE) === 'YES',
          hasDefault: (r.dflt ?? r.DFLT) !== null && (r.dflt ?? r.DFLT) !== undefined,
          autoIncrement: String(r.extra ?? r.EXTRA ?? '').includes('auto_increment'),
        }];
      }));
    }
    return this.cols;
  }

  protected async assertColumn(name: string): Promise<void> {
    if (!(await this.columns()).has(name)) throw new ValidationError(`Unknown field '${name}'`);
  }

  /** Build a WHERE clause: scalar => =, array => IN, null => IS NULL, {op,value} for comparisons. */
  protected async buildWhere(where: Where = {}): Promise<{ sql: string; params: unknown[] }> {
    const parts: string[] = [];
    const params: unknown[] = [];
    for (const [key, val] of Object.entries(where)) {
      if (val === undefined) continue;
      await this.assertColumn(key);
      if (val === null) parts.push(`\`${key}\` IS NULL`);
      else if (Array.isArray(val)) {
        if (!val.length) { parts.push('1=0'); continue; }
        parts.push(`\`${key}\` IN (${val.map(() => '?').join(',')})`);
        params.push(...val);
      } else if (typeof val === 'object' && !(val instanceof Date) && 'op' in (val as any)) {
        const { op, value } = val as { op: string; value: unknown };
        if (!['=', '<>', '<', '<=', '>', '>=', 'LIKE'].includes(op)) throw new ValidationError('Illegal operator');
        parts.push(`\`${key}\` ${op} ?`);
        params.push(value);
      } else {
        parts.push(`\`${key}\` = ?`);
        params.push(val);
      }
    }
    if (this.opts.softDelete && (await this.columns()).has('deleted')) parts.push('`deleted` = 0');
    return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
  }

  async findById(id: string | Record<string, unknown>, conn?: Queryable): Promise<T | null> {
    const where: Where = typeof id === 'string' ? { [this.pk[0]]: id } : id;
    const w = await this.buildWhere(where);
    return this.db.one<T>(`SELECT * FROM \`${this.table}\` ${w.sql} LIMIT 1`, w.params, conn);
  }

  async getById(id: string, label = this.table, conn?: Queryable): Promise<T> {
    const r = await this.findById(id, conn);
    if (!r) throw new NotFoundError(label, id);
    return r;
  }

  async findOne(where: Where, conn?: Queryable): Promise<T | null> {
    const w = await this.buildWhere(where);
    return this.db.one<T>(`SELECT * FROM \`${this.table}\` ${w.sql} LIMIT 1`, w.params, conn);
  }

  async findAll(where: Where = {}, order?: { by: string; dir?: 'ASC' | 'DESC' }, limit = 1000, conn?: Queryable): Promise<T[]> {
    const w = await this.buildWhere(where);
    let orderSql = '';
    if (order) {
      await this.assertColumn(order.by);
      orderSql = `ORDER BY \`${order.by}\` ${order.dir === 'DESC' ? 'DESC' : 'ASC'}`;
    }
    return this.db.query<T>(`SELECT * FROM \`${this.table}\` ${w.sql} ${orderSql} LIMIT ?`, [...w.params, limit], conn);
  }

  async count(where: Where = {}, conn?: Queryable): Promise<number> {
    const w = await this.buildWhere(where);
    return Number(await this.db.scalar(`SELECT COUNT(*) FROM \`${this.table}\` ${w.sql}`, w.params, conn));
  }

  async exists(where: Where, conn?: Queryable): Promise<boolean> {
    return (await this.count(where, conn)) > 0;
  }

  /** Pagination + allowlisted sorting + LIKE search. */
  async page(where: Where, req: PageRequest, q?: string, conn?: Queryable): Promise<Page<T>> {
    const cols = await this.columns();
    const w = await this.buildWhere(where);
    let sql = w.sql;
    const params = [...w.params];
    if (q && this.opts.searchable?.length) {
      const like = this.opts.searchable.filter((c) => cols.has(c)).map((c) => `\`${c}\` LIKE ?`);
      if (like.length) {
        sql += `${sql ? ' AND' : 'WHERE'} (${like.join(' OR ')})`;
        params.push(...like.map(() => `%${q.replace(/[%_\\]/g, '\\$&')}%`));
      }
    }
    const allowed = new Set((this.opts.sortable ?? [...cols.keys()]).filter((c) => cols.has(c)));
    const sortBy = req.sort && allowed.has(toSnake(req.sort)) ? toSnake(req.sort) : allowed.has('created_at') ? 'created_at' : this.pk[0];
    const total = Number(await this.db.scalar(`SELECT COUNT(*) FROM \`${this.table}\` ${sql}`, params, conn));
    const rows = await this.db.query<T>(
      `SELECT * FROM \`${this.table}\` ${sql} ORDER BY \`${sortBy}\` ${req.dir} LIMIT ? OFFSET ?`,
      [...params, req.size, req.page * req.size], conn);
    return { content: rows, page: req.page, size: req.size, totalElements: total, totalPages: Math.ceil(total / req.size) };
  }

  /** Insert with generated id, audit columns and safe zero defaults for NOT NULL flag/number columns. */
  async insert(data: Row, conn?: Queryable): Promise<T> {
    const cols = await this.columns();
    const row: Row = {};
    const user = requestContext.user();
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (!cols.has(k)) throw new ValidationError(`Unknown field '${k}'`);
      row[k] = v;
    }
    const now = new Date();
    if (this.pk.length === 1 && cols.has(this.pk[0]) && row[this.pk[0]] === undefined && !cols.get(this.pk[0])!.autoIncrement
      && cols.get(this.pk[0])!.dataType === 'varchar') row[this.pk[0]] = uuid();
    if (cols.has('created_at') && row.created_at === undefined) row.created_at = now;
    if (cols.has('updated_at') && row.updated_at === undefined) row.updated_at = now;
    if (cols.has('created_by') && row.created_by === undefined) row.created_by = user?.username ?? 'system';
    if (cols.has('updated_by') && row.updated_by === undefined) row.updated_by = user?.username ?? 'system';
    for (const c of cols.values()) {
      if (row[c.name] !== undefined || c.nullable || c.hasDefault || c.autoIncrement) continue;
      if (['bit', 'tinyint', 'int', 'bigint', 'decimal', 'smallint'].includes(c.dataType)) row[c.name] = 0;
    }
    const keys = Object.keys(row);
    const sql = `INSERT INTO \`${this.table}\` (${keys.map((k) => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    const res = await this.db.exec(sql, keys.map((k) => normalize(row[k])), conn);
    if (this.pk.length === 1 && cols.get(this.pk[0])?.autoIncrement) row[this.pk[0]] = res.insertId;
    return row as T;
  }

  /** Partial update by primary key; bumps `version` when the table has one. Returns affected rows. */
  async update(id: string | Where, patch: Row, conn?: Queryable): Promise<number> {
    const cols = await this.columns();
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || this.pk.includes(k)) continue;
      if (!cols.has(k)) throw new ValidationError(`Unknown field '${k}'`);
      sets.push(`\`${k}\` = ?`);
      params.push(normalize(v));
    }
    if (!sets.length) return 0;
    if (cols.has('updated_at') && patch.updated_at === undefined) { sets.push('`updated_at` = ?'); params.push(new Date()); }
    if (cols.has('updated_by') && patch.updated_by === undefined) { sets.push('`updated_by` = ?'); params.push(requestContext.user()?.username ?? 'system'); }
    if (cols.has('version') && patch.version === undefined) sets.push('`version` = `version` + 1');
    const where: Where = typeof id === 'string' ? { [this.pk[0]]: id } : id;
    const w = await this.buildWhere(where);
    const res = await this.db.exec(`UPDATE \`${this.table}\` SET ${sets.join(', ')} ${w.sql}`, [...params, ...w.params], conn);
    return res.affectedRows;
  }

  async remove(id: string | Where, conn?: Queryable): Promise<number> {
    const cols = await this.columns();
    const where: Where = typeof id === 'string' ? { [this.pk[0]]: id } : id;
    if (this.opts.softDelete && cols.has('deleted')) {
      return this.update(where, { deleted: 1, ...(cols.has('deleted_at') ? { deleted_at: new Date() } : {}) }, conn);
    }
    const saved = this.opts.softDelete; // hard delete path should not add deleted=0 filter
    const w = await this.buildWhere(where);
    void saved;
    const res = await this.db.exec(`DELETE FROM \`${this.table}\` ${w.sql}`, w.params, conn);
    return res.affectedRows;
  }
}

function normalize(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
}

/** Optimistic-locking helper for tables with a `version` column. */
export async function updateWithVersion(db: Db, table: string, id: string, version: number, set: Row, conn?: Queryable): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error('Illegal table name');
  const keys = Object.keys(set);
  for (const k of keys) if (!/^[a-z_][a-z0-9_]*$/i.test(k)) throw new ValidationError('Illegal column');
  const res = await db.exec(
    `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\` = ?`).join(', ')}, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`,
    [...keys.map((k) => normalize(set[k])), new Date(), id, version], conn);
  if (!res.affectedRows) throw new ConflictError('The record was modified by someone else; reload and retry');
}

export const dbPools = new Map<string, Db>();
export function getDb(database: string): Db {
  let d = dbPools.get(database);
  if (!d) { d = new Db(database); dbPools.set(database, d); }
  return d;
}

export function pageRequest(q: Record<string, any>, defaults = { size: 20, maxSize: 200 }): PageRequest {
  const page = Math.max(0, Number.parseInt(q.page ?? '0', 10) || 0);
  const size = Math.min(defaults.maxSize, Math.max(1, Number.parseInt(q.size ?? String(defaults.size), 10) || defaults.size));
  const [field, dir] = String(q.sort ?? '').split(',');
  return { page, size, sort: field || undefined, dir: (dir ?? q.dir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC' };
}

export function emptyPage<T>(req: PageRequest): Page<T> {
  return { content: [], page: req.page, size: req.size, totalElements: 0, totalPages: 0 };
}

/** INSERT ... ON DUPLICATE KEY UPDATE for snapshot tables (column names come from code, validated defensively). */
export async function upsertRow(db: Db, table: string, row: Row, conn?: Queryable): Promise<void> {
  const ident = /^[a-z_][a-z0-9_]*$/i;
  if (!ident.test(table)) throw new Error('Illegal table name');
  const keys = Object.keys(row);
  if (!keys.every((k) => ident.test(k))) throw new Error('Illegal column name');
  await db.exec(
    `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})
     ON DUPLICATE KEY UPDATE ${keys.map((k) => `\`${k}\` = VALUES(\`${k}\`)`).join(', ')}`,
    keys.map((k) => normalize(row[k])), conn);
}
