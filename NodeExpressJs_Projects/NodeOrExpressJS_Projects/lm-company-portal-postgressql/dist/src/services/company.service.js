"use strict";
// ============================================================
// WHAT: Company service using PostgreSQL raw queries (pg library)
// WHY:  Service layer isolates DB logic from HTTP controllers.
// HOW:  Uses parameterized queries ($1, $2...) for SQL injection safety.
// Interview Tip: SQL vs NoSQL — SQL enforces schema, FK constraints,
//               ACID transactions. NoSQL is more flexible but less safe.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyService = void 0;
const connection_1 = require("../database/connection");
const redis_client_1 = require("../cache/redis.client");
const constants_1 = require("../constants");
const exceptions_1 = require("../exceptions");
const env_config_1 = require("../config/env.config");
const response_helper_1 = require("../utils/response.helper");
exports.companyService = {
    async getAll(opts) {
        const { page, pageSize, search, sort = 'name', order = 'asc' } = opts;
        if (page === 1 && !search) {
            const cached = await (0, redis_client_1.cacheGet)(constants_1.CACHE_KEYS.COMPANIES);
            if (cached)
                return cached;
        }
        const offset = (page - 1) * pageSize;
        const sortCol = ['name', 'email', 'created_at'].includes(sort) ? sort : 'name';
        const sortDir = order === 'desc' ? 'DESC' : 'ASC';
        let whereClause = 'WHERE is_active = TRUE';
        const params = [];
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
            (0, connection_1.query)(dataQuery, params),
            (0, connection_1.query)(countQuery, countParams),
        ]);
        const total = countResult[0]?.total ?? 0;
        const result = { companies, meta: (0, response_helper_1.buildPaginationMeta)(total, page, pageSize) };
        if (page === 1 && !search) {
            await (0, redis_client_1.cacheSet)(constants_1.CACHE_KEYS.COMPANIES, result, env_config_1.config.redis.ttl);
        }
        return result;
    },
    async getById(id) {
        const cached = await (0, redis_client_1.cacheGet)(constants_1.CACHE_KEYS.COMPANY(id));
        if (cached)
            return cached;
        const rows = await (0, connection_1.query)('SELECT * FROM companies WHERE id = $1 AND is_active = TRUE', [id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Company');
        await (0, redis_client_1.cacheSet)(constants_1.CACHE_KEYS.COMPANY(id), rows[0], env_config_1.config.redis.ttl);
        return rows[0];
    },
    async create(data) {
        const rows = await (0, connection_1.query)(`
      INSERT INTO companies (name, address, email, phone, description, website)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [data.name, data.address, data.email, data.phone, data.description ?? null, data.website ?? null]);
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.COMPANIES);
        return rows[0];
    },
    async update(id, data) {
        const rows = await (0, connection_1.query)(`
      UPDATE companies
      SET name=$1, address=$2, email=$3, phone=$4, description=$5, website=$6, updated_at=NOW()
      WHERE id=$7 AND is_active=TRUE
      RETURNING *
    `, [data.name, data.address, data.email, data.phone, data.description, data.website, id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Company');
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.COMPANIES, constants_1.CACHE_KEYS.COMPANY(id));
        return rows[0];
    },
    async patch(id, data) {
        const existing = await exports.companyService.getById(id);
        return exports.companyService.update(id, { ...existing, ...data });
    },
    async delete(id) {
        const rows = await (0, connection_1.query)(`UPDATE companies SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Company');
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.COMPANIES, constants_1.CACHE_KEYS.COMPANY(id));
        return rows[0];
    },
};
