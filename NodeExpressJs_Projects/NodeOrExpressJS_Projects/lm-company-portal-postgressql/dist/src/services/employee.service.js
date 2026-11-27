"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeService = void 0;
const connection_1 = require("../database/connection");
const redis_client_1 = require("../cache/redis.client");
const constants_1 = require("../constants");
const exceptions_1 = require("../exceptions");
const response_helper_1 = require("../utils/response.helper");
exports.employeeService = {
    async getAll(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const [employees, countResult] = await Promise.all([
            (0, connection_1.query)(`
        SELECT e.*,
               d.name AS department_name,
               CONCAT(m.first_name, ' ', m.last_name) AS manager_name
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN employees m ON m.id = e.manager_id
        WHERE e.is_active = TRUE
        ORDER BY e.created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
            (0, connection_1.query)('SELECT COUNT(*)::int AS total FROM employees WHERE is_active = TRUE'),
        ]);
        return { employees, meta: (0, response_helper_1.buildPaginationMeta)(countResult[0]?.total ?? 0, page, pageSize) };
    },
    async getById(id) {
        const rows = await (0, connection_1.query)(`
      SELECT e.*,
             d.name AS department_name,
             CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
             m.email AS manager_email
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN employees m ON m.id = e.manager_id
      WHERE e.id = $1
    `, [id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Employee');
        return rows[0];
    },
    async create(data) {
        const rows = await (0, connection_1.query)(`
      INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, manager_id, salary)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [data.employee_code, data.first_name, data.last_name, data.email,
            data.department_id, data.designation, data.manager_id ?? null, data.salary]);
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.EMPLOYEES);
        return rows[0];
    },
    async update(id, data) {
        const rows = await (0, connection_1.query)(`
      UPDATE employees
      SET first_name=$1, last_name=$2, email=$3, department_id=$4,
          designation=$5, manager_id=$6, salary=$7, updated_at=NOW()
      WHERE id=$8 AND is_active=TRUE RETURNING *
    `, [data.first_name, data.last_name, data.email, data.department_id,
            data.designation, data.manager_id ?? null, data.salary, id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Employee');
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.EMPLOYEES, constants_1.CACHE_KEYS.EMPLOYEE(id));
        return rows[0];
    },
    async delete(id) {
        const rows = await (0, connection_1.query)(`UPDATE employees SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('Employee');
        await (0, redis_client_1.cacheDel)(constants_1.CACHE_KEYS.EMPLOYEES, constants_1.CACHE_KEYS.EMPLOYEE(id));
        return rows[0];
    },
};
