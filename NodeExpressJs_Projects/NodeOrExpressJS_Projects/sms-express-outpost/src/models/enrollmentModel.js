const pool = require("../config/db");

async function create({ tenantId, studentId, courseId }) {
  const [result] = await pool.query(
    `INSERT INTO enrollments (tenant_id, student_id, course_id) VALUES (?, ?, ?)`,
    [tenantId, studentId, courseId]
  );
  return findById(result.insertId);
}

async function findAll({ tenantId, studentId } = {}) {
  const clauses = [];
  const args = [];
  if (tenantId) {
    clauses.push("tenant_id = ?");
    args.push(tenantId);
  }
  if (studentId) {
    clauses.push("student_id = ?");
    args.push(studentId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await pool.query(`SELECT * FROM enrollments ${where} ORDER BY id`, args);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM enrollments WHERE id = ?", [id]);
  return rows[0] || null;
}

async function updateStatus(id, status) {
  await pool.query("UPDATE enrollments SET status = ? WHERE id = ?", [status, id]);
  return findById(id);
}

module.exports = { create, findAll, findById, updateStatus };
