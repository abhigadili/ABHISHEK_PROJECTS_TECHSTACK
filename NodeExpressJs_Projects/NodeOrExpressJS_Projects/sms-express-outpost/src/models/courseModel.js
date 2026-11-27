const pool = require("../config/db");

async function create({ tenantId, code, title, credits }) {
  const [result] = await pool.query(
    `INSERT INTO courses (tenant_id, code, title, credits) VALUES (?, ?, ?, ?)`,
    [tenantId, code, title, credits ?? 3]
  );
  return findById(result.insertId);
}

async function findAll(tenantId) {
  if (tenantId) {
    const [rows] = await pool.query("SELECT * FROM courses WHERE tenant_id = ? ORDER BY id", [tenantId]);
    return rows;
  }
  const [rows] = await pool.query("SELECT * FROM courses ORDER BY id");
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM courses WHERE id = ?", [id]);
  return rows[0] || null;
}

async function update(id, { title, credits }) {
  await pool.query(
    `UPDATE courses SET title = COALESCE(?, title), credits = COALESCE(?, credits) WHERE id = ?`,
    [title, credits, id]
  );
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.query("DELETE FROM courses WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = { create, findAll, findById, update, remove };
