import { query } from '../database/connection';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError } from '../exceptions';
import { config } from '../config/env.config';
import { buildPaginationMeta } from '../utils/response.helper';
import { IDepartment } from '../types/entities';

export const departmentService = {

  async getAll(page = 1, pageSize = 10) {
    if (page === 1) {
      const cached = await cacheGet<any>(CACHE_KEYS.DEPARTMENTS);
      if (cached) return cached;
    }

    const offset = (page - 1) * pageSize;
    const [departments, countResult] = await Promise.all([
      query(`
        SELECT d.*, c.name AS company_name
        FROM departments d
        LEFT JOIN companies c ON c.id = d.company_id
        WHERE d.is_active = TRUE
        ORDER BY d.name ASC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
      query<{ total: number }>('SELECT COUNT(*)::int AS total FROM departments WHERE is_active = TRUE'),
    ]);

    const result = { departments, meta: buildPaginationMeta(countResult[0]?.total ?? 0, page, pageSize) };
    if (page === 1) await cacheSet(CACHE_KEYS.DEPARTMENTS, result, config.redis.ttl);
    return result;
  },

  async getById(id: string) {
    const rows = await query(`
      SELECT d.*, c.name AS company_name
      FROM departments d LEFT JOIN companies c ON c.id = d.company_id
      WHERE d.id = $1
    `, [id]);
    if (!rows[0]) throw new NotFoundError('Department');
    return rows[0];
  },

  async create(data: Partial<IDepartment>) {
    const rows = await query(`
      INSERT INTO departments (name, description, company_id)
      VALUES ($1, $2, $3) RETURNING *
    `, [data.name, data.description ?? null, data.company_id]);
    await cacheDel(CACHE_KEYS.DEPARTMENTS);
    return rows[0];
  },

  async update(id: string, data: Partial<IDepartment>) {
    const rows = await query(`
      UPDATE departments SET name=$1, description=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [data.name, data.description, id]);
    if (!rows[0]) throw new NotFoundError('Department');
    await cacheDel(CACHE_KEYS.DEPARTMENTS, CACHE_KEYS.DEPARTMENT(id));
    return rows[0];
  },

  async delete(id: string) {
    const rows = await query(
      `UPDATE departments SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    if (!rows[0]) throw new NotFoundError('Department');
    await cacheDel(CACHE_KEYS.DEPARTMENTS, CACHE_KEYS.DEPARTMENT(id));
    return rows[0];
  },
};
