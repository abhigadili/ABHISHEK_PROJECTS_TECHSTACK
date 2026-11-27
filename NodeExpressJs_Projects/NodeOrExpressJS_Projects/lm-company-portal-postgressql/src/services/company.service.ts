// ============================================================
// WHAT: Company service using PostgreSQL raw queries (pg library)
// WHY:  Service layer isolates DB logic from HTTP controllers.
// HOW:  Uses parameterized queries ($1, $2...) for SQL injection safety.
// Interview Tip: SQL vs NoSQL — SQL enforces schema, FK constraints,
//               ACID transactions. NoSQL is more flexible but less safe.
// ============================================================

import { query } from '../database/connection';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError } from '../exceptions';
import { config } from '../config/env.config';
import { buildPaginationMeta } from '../utils/response.helper';
import { ICompany } from '../types/entities';

export const companyService = {

  async getAll(opts: { page: number; pageSize: number; search?: string; sort?: string; order?: string }) {
    const { page, pageSize, search, sort = 'name', order = 'asc' } = opts;

    if (page === 1 && !search) {
      const cached = await cacheGet<{ companies: ICompany[]; meta: any }>(CACHE_KEYS.COMPANIES);
      if (cached) return cached;
    }

    const offset = (page - 1) * pageSize;
    const sortCol = ['name','email','created_at'].includes(sort) ? sort : 'name';
    const sortDir = order === 'desc' ? 'DESC' : 'ASC';

    let whereClause = 'WHERE is_active = TRUE';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    params.push(pageSize, offset);
    const dataQuery = `
      SELECT * FROM companies
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const countParams = search ? [params[0]] : [];
    const countWhere = search ? `WHERE is_active = TRUE AND (name ILIKE $1 OR description ILIKE $1)` : 'WHERE is_active = TRUE';
    const countQuery = `SELECT COUNT(*)::int AS total FROM companies ${countWhere}`;

    const [companies, countResult] = await Promise.all([
      query<ICompany>(dataQuery, params),
      query<{ total: number }>(countQuery, countParams),
    ]);

    const total = countResult[0]?.total ?? 0;
    const result = { companies, meta: buildPaginationMeta(total, page, pageSize) };

    if (page === 1 && !search) {
      await cacheSet(CACHE_KEYS.COMPANIES, result, config.redis.ttl);
    }

    return result;
  },

  async getById(id: string) {
    const cached = await cacheGet<ICompany>(CACHE_KEYS.COMPANY(id));
    if (cached) return cached;

    const rows = await query<ICompany>('SELECT * FROM companies WHERE id = $1 AND is_active = TRUE', [id]);
    if (!rows[0]) throw new NotFoundError('Company');

    await cacheSet(CACHE_KEYS.COMPANY(id), rows[0], config.redis.ttl);
    return rows[0];
  },

  async create(data: Partial<ICompany>) {
    const rows = await query<ICompany>(`
      INSERT INTO companies (name, address, email, phone, description, website)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [data.name, data.address, data.email, data.phone, data.description ?? null, data.website ?? null]);

    await cacheDel(CACHE_KEYS.COMPANIES);
    return rows[0];
  },

  async update(id: string, data: Partial<ICompany>) {
    const rows = await query<ICompany>(`
      UPDATE companies
      SET name=$1, address=$2, email=$3, phone=$4, description=$5, website=$6, updated_at=NOW()
      WHERE id=$7 AND is_active=TRUE
      RETURNING *
    `, [data.name, data.address, data.email, data.phone, data.description, data.website, id]);

    if (!rows[0]) throw new NotFoundError('Company');
    await cacheDel(CACHE_KEYS.COMPANIES, CACHE_KEYS.COMPANY(id));
    return rows[0];
  },

  async patch(id: string, data: Partial<ICompany>) {
    const existing = await companyService.getById(id);
    return companyService.update(id, { ...existing, ...data });
  },

  async delete(id: string) {
    const rows = await query<ICompany>(
      `UPDATE companies SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    if (!rows[0]) throw new NotFoundError('Company');
    await cacheDel(CACHE_KEYS.COMPANIES, CACHE_KEYS.COMPANY(id));
    return rows[0];
  },
};
