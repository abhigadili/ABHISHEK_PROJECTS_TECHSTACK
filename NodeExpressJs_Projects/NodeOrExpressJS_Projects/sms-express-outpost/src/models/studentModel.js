const pool = require("../config/db");

async function create({ tenantId, firstName, lastName, email, department, enrollmentDate }) {
  const [result] = await pool.query(
    `INSERT INTO students (tenant_id, first_name, last_name, email, department, enrollment_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, firstName, lastName, email, department, enrollmentDate]
  );
  return findById(result.insertId);
}

async function findAll(tenantId) {
  if (tenantId) {
    const [rows] = await pool.query("SELECT * FROM students WHERE tenant_id = ? ORDER BY id", [tenantId]);
    return rows;
  }
  const [rows] = await pool.query("SELECT * FROM students ORDER BY id");
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [id]);
  return rows[0] || null;
}

async function update(id, { firstName, lastName, email, department, status }) {
  await pool.query(
    `UPDATE students SET
       first_name = COALESCE(?, first_name),
       last_name = COALESCE(?, last_name),
       email = COALESCE(?, email),
       department = COALESCE(?, department),
       status = COALESCE(?, status)
     WHERE id = ?`,
    [firstName, lastName, email, department, status, id]
  );
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.query("DELETE FROM students WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = { create, findAll, findById, update, remove };
