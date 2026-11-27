"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentService = void 0;
const connection_1 = require("../database/connection");
const redis_client_1 = require("../cache/redis.client");
const constants_1 = require("../constants");
const exceptions_1 = require("../exceptions");
const env_config_1 = require("../config/env.config");
const response_helper_1 = require("../utils/response.helper");
exports.departmentService = {
    async getAll(page = 1, pageSize = 10) {
        if (page === 1) {
            const cached = await (0, redis_client_1.cacheGet)(constants_1.CACHE_KEYS.DEPARTMENTS);
            if (cached)
                return cached;
        }
        const offset = (page - 1) * pageSize;
        const [departments, countResult] = await Promise.all([
            (0, connection_1.query)(`
        SELECT d.*, c.name AS company_name
        FROM departments d
        LEFT JOIN companies c ON c.id = d.company_id
        WHERE d.is_active = TRUE
        ORDER BY d.name ASC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
            (0, connection_1.query)('SELECT COUNT(*)::int AS total FROM departments WHERE is_active = TRUE'),
        ]);
        const result = { departments, meta: (0, response_helper_1.buildPaginationMeta)(countResult[0]?.total ?? 0, page, pageSize) };
        if (page === 1)
            await (0, redis_client_1.cacheSet)(constants_1.CACHE_KEYS.DEPARTMENTS, result, env_config_1.config.redis.ttl);
        return result;
    },
    async getById(id) {
        const rows = await (0, connection_1.query)(`
      SELECT d.*, c.name AS company_name
      FROM departments d LEFT JOIN companies c ON c.id = d.company_id
      WHERE d.id = $1
    `, [id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Department');
        return rows[0];
    },
    async create(data) {
        const rows = await (0, connection_1.query)(`
      INSERT INTO departments (name, description, company_id)
      VALUES ($1, $2, $3) RETURNING *
    `, [data.name, data.description ?? null, data.company_id]);
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.DEPARTMENTS);
        return rows[0];
    },
    async update(id, data) {
        const rows = await (0, connection_1.query)(`
      UPDATE departments SET name=$1, description=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [data.name, data.description, id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Department');
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.DEPARTMENTS, constants_1.CACHE_KEYS.DEPARTMENT(id));
        return rows[0];
    },
    async delete(id) {
        const rows = await (0, connection_1.query)(`UPDATE departments SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Department');
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.DEPARTMENTS, constants_1.CACHE_KEYS.DEPARTMENT(id));
        return rows[0];
    },
};
