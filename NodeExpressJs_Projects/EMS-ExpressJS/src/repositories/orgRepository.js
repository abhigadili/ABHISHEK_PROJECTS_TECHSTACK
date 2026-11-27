const { query } = require('../config/database');

const MAX_DEPTH = 25;

/** Ids of every manager above `employeeId` (nearest first). Cycle-safe: stops on a repeated id. */
async function ancestorIds(employeeId, conn) {
  const rows = await query(
    `WITH RECURSIVE up AS (
       SELECT id, manager_id, 0 AS lvl, CAST(CONCAT(',', id, ',') AS CHAR(1000)) AS path FROM employees WHERE id = ?
       UNION ALL
       SELECT e.id, e.manager_id, up.lvl + 1, CONCAT(up.path, e.id, ',')
       FROM employees e JOIN up ON e.id = up.manager_id
       WHERE up.lvl < ? AND LOCATE(CONCAT(',', e.id, ','), up.path) = 0
     ) SELECT id, lvl FROM up WHERE lvl > 0 ORDER BY lvl`, [employeeId, MAX_DEPTH], conn);
  return rows.map((r) => r.id);
}

/** Subtree below `rootId` (excluding root). Returns flat rows incl. depth. Cycle-safe + depth-limited. */
async function descendants(rootId, { maxDepth = MAX_DEPTH, activeOnly = true } = {}, conn) {
  const act = activeOnly ? "AND e.status = 'ACTIVE'" : '';
  return query(
    `WITH RECURSIVE down AS (
       SELECT id, manager_id, 0 AS depth, CAST(CONCAT(',', id, ',') AS CHAR(2000)) AS path FROM employees WHERE id = ?
       UNION ALL
       SELECT e.id, e.manager_id, down.depth + 1, CONCAT(down.path, e.id, ',')
       FROM employees e JOIN down ON e.manager_id = down.id
       WHERE down.depth < ? ${act} AND LOCATE(CONCAT(',', e.id, ','), down.path) = 0
     ) SELECT id, depth FROM down WHERE depth > 0`, [rootId, Math.min(maxDepth, MAX_DEPTH)], conn);
}
async function descendantIds(rootId, conn) { return (await descendants(rootId, { activeOnly: false }, conn)).map((r) => r.id); }

const NODE_COLS = `e.id, e.employee_code AS employeeCode, e.first_name AS firstName, e.last_name AS lastName, e.work_email AS workEmail,
  e.manager_id AS managerId, e.status, e.job_title AS jobTitle, ds.name AS designation, d.id AS departmentId, d.name AS department,
  (pp.employee_id IS NOT NULL) AS hasPicture`;
const NODE_JOINS = `FROM employees e LEFT JOIN designations ds ON ds.id = e.designation_id LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employee_profile_pictures pp ON pp.employee_id = e.id`;

/** Nodes for a tree rooted at rootId (null => all roots), with depth, in one recursive query. */
async function treeRows({ rootId, maxDepth, departmentId }) {
  const depth = Math.min(maxDepth || MAX_DEPTH, MAX_DEPTH);
  const seed = rootId ? 'e.id = ?' : "(e.manager_id IS NULL OR NOT EXISTS (SELECT 1 FROM employees m WHERE m.id = e.manager_id AND m.status = 'ACTIVE'))";
  const params = rootId ? [rootId] : [];
  const rows = await query(
    `WITH RECURSIVE tree AS (
       SELECT e.id, 0 AS depth, CAST(CONCAT(',', e.id, ',') AS CHAR(2000)) AS path FROM employees e WHERE ${seed} AND e.status = 'ACTIVE'
       UNION ALL
       SELECT e.id, tree.depth + 1, CONCAT(tree.path, e.id, ',')
       FROM employees e JOIN tree ON e.manager_id = tree.id
       WHERE e.status = 'ACTIVE' AND tree.depth < ? AND LOCATE(CONCAT(',', e.id, ','), tree.path) = 0
     )
     SELECT ${NODE_COLS}, tree.depth, tree.path
     FROM tree JOIN employees e ON e.id = tree.id
     LEFT JOIN designations ds ON ds.id = e.designation_id LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN employee_profile_pictures pp ON pp.employee_id = e.id
     ORDER BY tree.depth, e.last_name, e.first_name`, [...params, depth]);
  return rows;
}

const directReports = (managerId) => query(
  `SELECT ${NODE_COLS}, (SELECT COUNT(*) FROM employees x WHERE x.manager_id = e.id AND x.status = 'ACTIVE') AS directReportCount
   ${NODE_JOINS} WHERE e.manager_id = ? AND e.status = 'ACTIVE' ORDER BY e.last_name, e.first_name`, [managerId]);

const nodesByIds = (ids) => ids.length
  ? query(`SELECT ${NODE_COLS} ${NODE_JOINS} WHERE e.id IN (?)`, [ids]) : Promise.resolve([]);

const searchInTree = (rootIds, q) => {
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  return query(
    `SELECT ${NODE_COLS} ${NODE_JOINS} WHERE e.status = 'ACTIVE' AND e.id IN (?)
       AND (e.first_name LIKE ? OR e.last_name LIKE ? OR CONCAT(e.first_name,' ',e.last_name) LIKE ? OR e.employee_code LIKE ? OR e.job_title LIKE ?)
     ORDER BY e.last_name LIMIT 50`, [rootIds.length ? rootIds : [0], like, like, like, like, like]);
};

module.exports = { MAX_DEPTH, ancestorIds, descendants, descendantIds, treeRows, directReports, nodesByIds, searchInTree };
