"use strict";
// ============================================================
// WHAT: PostgreSQL Learning Module — SQL operations demonstrated via API
// WHY:  Teaches SQL through hands-on API calls, just like the MongoDB
//       learning module taught MongoDB operations.
// HOW:  Each endpoint demonstrates one SQL concept with inline explanations.
// Interview Tip: Know the differences between SQL and NoSQL cold:
//   SQL:   schema-enforced, ACID, JOINs, transactions, normalized data
//   NoSQL: schema-flexible, horizontal scale, embedded docs, denormalized
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.postgresqlController = void 0;
const connection_1 = require("../database/connection");
const response_helper_1 = require("../utils/response.helper");
exports.postgresqlController = {
    // Show all tables in the database
    // Equivalent to MongoDB's: show collections
    async showTables(_req, res, next) {
        try {
            const tables = await (0, connection_1.query)(`
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
            (0, response_helper_1.sendSuccess)(res, tables, 'All tables in public schema');
        }
        catch (err) {
            next(err);
        }
    },
    // Show table schema / column definitions
    // Equivalent to MongoDB's: db.collection.getIndexes()
    async describeTable(req, res, next) {
        try {
            const { table } = req.params;
            const columns = await (0, connection_1.query)(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
            (0, response_helper_1.sendSuccess)(res, columns, `Schema for table: ${table}`);
        }
        catch (err) {
            next(err);
        }
    },
    // INSERT — add a single row
    // Interview Tip: RETURNING * is PostgreSQL-specific — returns inserted row immediately.
    //               In MySQL you'd use INSERT and then SELECT LAST_INSERT_ID().
    async insertOne(req, res, next) {
        try {
            const { firstName, lastName, email, designation, departmentId, salary, employeeCode } = req.body;
            const rows = await (0, connection_1.query)(`
        INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, salary)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [employeeCode, firstName, lastName, email, departmentId, designation, salary]);
            (0, response_helper_1.sendSuccess)(res, rows[0], 'INSERT: single row created');
        }
        catch (err) {
            next(err);
        }
    },
    // SELECT with WHERE (equivalent to find() with filter)
    // Interview Tip: PostgreSQL is case-sensitive for string comparisons.
    //               Use ILIKE for case-insensitive LIKE (MongoDB $regex with /i flag).
    async selectWhere(req, res, next) {
        try {
            const { designation, minSalary = 0 } = req.query;
            // Parameterized query — $1, $2 placeholders prevent SQL injection
            const rows = await (0, connection_1.query)(`
        SELECT id, first_name, last_name, email, designation, salary
        FROM employees
        WHERE is_active = TRUE
          AND ($1::text IS NULL OR designation ILIKE $1)
          AND salary >= $2
        ORDER BY salary DESC
      `, [designation || null, minSalary]);
            (0, response_helper_1.sendSuccess)(res, rows, 'SELECT with WHERE filters');
        }
        catch (err) {
            next(err);
        }
    },
    // SELECT with JOIN — equivalent to MongoDB $lookup
    // Interview Tip: SQL JOINs are native; MongoDB $lookup is a pipeline stage.
    //               SQL JOINs are generally more efficient for relational data.
    async selectJoin(req, res, next) {
        try {
            const rows = await (0, connection_1.query)(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name AS full_name,
          e.email,
          e.designation,
          e.salary,
          d.name AS department,
          c.name AS company,
          CONCAT(m.first_name, ' ', m.last_name) AS manager
        FROM employees e
        LEFT JOIN departments  d ON d.id = e.department_id
        LEFT JOIN companies    c ON c.id = d.company_id
        LEFT JOIN employees    m ON m.id = e.manager_id
        WHERE e.is_active = TRUE
        ORDER BY e.first_name
        LIMIT 20
      `);
            (0, response_helper_1.sendSuccess)(res, rows, 'SELECT with multiple JOINs');
        }
        catch (err) {
            next(err);
        }
    },
    // UPDATE with RETURNING
    async updateOne(req, res, next) {
        try {
            const { id } = req.params;
            const { salary, designation } = req.body;
            const rows = await (0, connection_1.query)(`
        UPDATE employees
        SET salary=$1, designation=$2, updated_at=NOW()
        WHERE id=$3 AND is_active=TRUE
        RETURNING *
      `, [salary, designation, id]);
            (0, response_helper_1.sendSuccess)(res, rows[0] ?? null, 'UPDATE single row');
        }
        catch (err) {
            next(err);
        }
    },
    // DELETE (hard delete for demo)
    async deleteOne(req, res, next) {
        try {
            const rows = await (0, connection_1.query)('DELETE FROM employees WHERE id=$1 RETURNING id, email', [req.params.id]);
            (0, response_helper_1.sendSuccess)(res, rows[0] ?? null, 'DELETE single row');
        }
        catch (err) {
            next(err);
        }
    },
    // Pagination with LIMIT and OFFSET
    // Interview Tip: OFFSET-based pagination scans all skipped rows.
    //               For large tables, use cursor-based: WHERE id > $lastId LIMIT n
    async pagination(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const pageSize = parseInt(req.query.pageSize, 10) || 10;
            const offset = (page - 1) * pageSize;
            const [rows, countResult] = await Promise.all([
                (0, connection_1.query)(`SELECT * FROM employees WHERE is_active=TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [pageSize, offset]),
                (0, connection_1.query)('SELECT COUNT(*)::int AS total FROM employees WHERE is_active=TRUE'),
            ]);
            (0, response_helper_1.sendSuccess)(res, {
                data: rows,
                pagination: {
                    page, pageSize,
                    total: countResult[0]?.total ?? 0,
                    totalPages: Math.ceil((countResult[0]?.total ?? 0) / pageSize),
                }
            }, 'Pagination with LIMIT/OFFSET');
        }
        catch (err) {
            next(err);
        }
    },
    // Sorting: ORDER BY ASC / DESC
    async sorting(_req, res, next) {
        try {
            const [asc, desc, multi] = await Promise.all([
                (0, connection_1.query)('SELECT first_name, last_name, salary FROM employees ORDER BY salary ASC LIMIT 5'),
                (0, connection_1.query)('SELECT first_name, last_name, salary FROM employees ORDER BY salary DESC LIMIT 5'),
                (0, connection_1.query)('SELECT first_name, designation, salary FROM employees ORDER BY designation ASC, salary DESC LIMIT 5'),
            ]);
            (0, response_helper_1.sendSuccess)(res, { ascending: asc, descending: desc, multiColumn: multi }, 'ORDER BY examples');
        }
        catch (err) {
            next(err);
        }
    },
    // GROUP BY — equivalent to MongoDB $group aggregation stage
    // Interview Tip: GROUP BY requires all non-aggregate SELECT columns to be in GROUP BY.
    //               This is stricter than MongoDB $group.
    async groupBy(_req, res, next) {
        try {
            const rows = await (0, connection_1.query)(`
        SELECT
          designation,
          COUNT(*)::int          AS count,
          ROUND(AVG(salary),2)   AS avg_salary,
          MAX(salary)            AS max_salary,
          MIN(salary)            AS min_salary,
          SUM(salary)            AS total_salary
        FROM employees
        WHERE is_active = TRUE
        GROUP BY designation
        ORDER BY count DESC
      `);
            (0, response_helper_1.sendSuccess)(res, rows, 'GROUP BY: salary stats per designation');
        }
        catch (err) {
            next(err);
        }
    },
    // HAVING — filter after GROUP BY (cannot use WHERE for aggregates)
    // Interview Tip: WHERE filters rows BEFORE grouping; HAVING filters AFTER.
    //               This is a very common interview question.
    async having(_req, res, next) {
        try {
            const rows = await (0, connection_1.query)(`
        SELECT designation, COUNT(*)::int AS count, ROUND(AVG(salary),2) AS avg_salary
        FROM employees
        WHERE is_active = TRUE
        GROUP BY designation
        HAVING COUNT(*) > 1
        ORDER BY avg_salary DESC
      `);
            (0, response_helper_1.sendSuccess)(res, rows, 'HAVING: designations with more than 1 employee');
        }
        catch (err) {
            next(err);
        }
    },
    // Subquery example
    async subquery(_req, res, next) {
        try {
            // Employees earning above the company average
            const rows = await (0, connection_1.query)(`
        SELECT first_name, last_name, designation, salary
        FROM employees
        WHERE salary > (SELECT AVG(salary) FROM employees WHERE is_active=TRUE)
          AND is_active = TRUE
        ORDER BY salary DESC
      `);
            (0, response_helper_1.sendSuccess)(res, rows, 'Subquery: employees above average salary');
        }
        catch (err) {
            next(err);
        }
    },
    // CTE (Common Table Expression) — WITH clause
    // Equivalent to MongoDB $facet or complex pipelines
    // Interview Tip: CTEs improve readability and can be referenced multiple times.
    //               Recursive CTEs solve hierarchical problems (org charts, trees).
    async cte(_req, res, next) {
        try {
            const rows = await (0, connection_1.query)(`
        WITH dept_stats AS (
          SELECT
            d.id,
            d.name AS department,
            COUNT(e.id)::int       AS headcount,
            ROUND(AVG(e.salary),2) AS avg_salary
          FROM departments d
          LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = TRUE
          GROUP BY d.id, d.name
        ),
        ranked AS (
          SELECT *, RANK() OVER (ORDER BY avg_salary DESC NULLS LAST) AS salary_rank
          FROM dept_stats
        )
        SELECT * FROM ranked ORDER BY salary_rank
      `);
            (0, response_helper_1.sendSuccess)(res, rows, 'CTE: department salary ranking with window function');
        }
        catch (err) {
            next(err);
        }
    },
    // Window Functions — RANK, ROW_NUMBER, LAG, LEAD
    // No MongoDB equivalent — this is a SQL superpower.
    // Interview Tip: Window functions compute across a set of rows related to the current row
    //               WITHOUT collapsing them (unlike GROUP BY).
    async windowFunctions(_req, res, next) {
        try {
            const rows = await (0, connection_1.query)(`
        SELECT
          first_name,
          last_name,
          designation,
          salary,
          RANK()       OVER (PARTITION BY designation ORDER BY salary DESC) AS rank_in_designation,
          ROW_NUMBER() OVER (ORDER BY salary DESC)                          AS overall_rank,
          ROUND(AVG(salary) OVER (PARTITION BY designation), 2)            AS dept_avg_salary,
          salary - ROUND(AVG(salary) OVER (PARTITION BY designation), 2)   AS diff_from_avg
        FROM employees
        WHERE is_active = TRUE
        ORDER BY designation, rank_in_designation
        LIMIT 20
      `);
            (0, response_helper_1.sendSuccess)(res, rows, 'Window functions: RANK, ROW_NUMBER, AVG OVER');
        }
        catch (err) {
            next(err);
        }
    },
    // Transaction example — transfer salary between two employees atomically
    // Interview Tip: ACID transactions ensure all-or-nothing. If step 2 fails,
    //               step 1 is rolled back. Critical for financial operations.
    async transaction(req, res, next) {
        try {
            const { fromId, toId, amount } = req.body;
            const client = await connection_1.pool.connect();
            try {
                await client.query('BEGIN');
                // Deduct from source
                await client.query('UPDATE employees SET salary = salary - $1, updated_at=NOW() WHERE id=$2', [amount, fromId]);
                // Add to destination
                await client.query('UPDATE employees SET salary = salary + $1, updated_at=NOW() WHERE id=$2', [amount, toId]);
                await client.query('COMMIT');
                (0, response_helper_1.sendSuccess)(res, { transferred: amount, from: fromId, to: toId }, 'Transaction: salary transfer committed');
            }
            catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
            finally {
                client.release();
            }
        }
        catch (err) {
            next(err);
        }
    },
    // EXPLAIN ANALYZE — query performance analysis
    // No MongoDB equivalent (use explain() in Mongo shell)
    // Interview Tip: Always EXPLAIN your slow queries in production.
    //               Look for Sequential Scans on large tables — they need indexes.
    async explainQuery(req, res, next) {
        try {
            const { sql = 'SELECT * FROM employees WHERE is_active=TRUE' } = req.query;
            const result = await connection_1.pool.query(`EXPLAIN ANALYZE ${sql}`);
            (0, response_helper_1.sendSuccess)(res, result.rows.map((r) => r['QUERY PLAN']), 'EXPLAIN ANALYZE output');
        }
        catch (err) {
            next(err);
        }
    },
    // Full-text search using tsvector
    // Equivalent to MongoDB $text operator
    // Interview Tip: PostgreSQL full-text search is powerful but Elasticsearch
    //               is preferred for production search-heavy apps.
    async fullTextSearch(req, res, next) {
        try {
            const { q = 'engineer' } = req.query;
            const rows = await (0, connection_1.query)(`
        SELECT id, first_name, last_name, designation, salary,
               ts_rank(to_tsvector('english', designation), plainto_tsquery('english', $1)) AS relevance
        FROM employees
        WHERE to_tsvector('english', designation || ' ' || first_name || ' ' || last_name)
              @@ plainto_tsquery('english', $1)
        ORDER BY relevance DESC
        LIMIT 10
      `, [q]);
            (0, response_helper_1.sendSuccess)(res, rows, `Full-text search for: "${q}"`);
        }
        catch (err) {
            next(err);
        }
    },
    // Dashboard stats using multiple parallel queries
    async dashboardStats(_req, res, next) {
        try {
            const [empCount, compCount, salaryStats, recentEmps] = await Promise.all([
                (0, connection_1.query)('SELECT COUNT(*)::int AS total FROM employees WHERE is_active=TRUE'),
                (0, connection_1.query)('SELECT COUNT(*)::int AS total FROM companies WHERE is_active=TRUE'),
                (0, connection_1.query)(`SELECT ROUND(AVG(salary),2) AS avg, MAX(salary) AS max, MIN(salary) AS min FROM employees WHERE is_active=TRUE`),
                (0, connection_1.query)(`SELECT first_name, last_name, designation, created_at FROM employees WHERE is_active=TRUE ORDER BY created_at DESC LIMIT 5`),
            ]);
            (0, response_helper_1.sendSuccess)(res, {
                totalEmployees: empCount[0]?.total,
                totalCompanies: compCount[0]?.total,
                salaryStats: salaryStats[0],
                recentEmployees: recentEmps,
            }, 'Dashboard statistics');
        }
        catch (err) {
            next(err);
        }
    },
};
