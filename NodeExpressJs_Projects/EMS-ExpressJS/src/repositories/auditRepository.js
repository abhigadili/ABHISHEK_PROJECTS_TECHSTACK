const { query } = require('../config/database');

const insert = ({ userId, action, entityType, entityId, details, ip, requestId }, conn) =>
  query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, request_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId || null, action, entityType, entityId === undefined || entityId === null ? null : String(entityId),
      details ? JSON.stringify(details) : null, ip || null, requestId || null], conn);

async function list({ entityType, entityId, userId, limit, offset }) {
  const where = []; const p = [];
  if (entityType) { where.push('entity_type = ?'); p.push(entityType); }
  if (entityId) { where.push('entity_id = ?'); p.push(String(entityId)); }
  if (userId) { where.push('user_id = ?'); p.push(userId); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) c FROM audit_logs ${w}`, p))[0].c;
  const items = await query(`SELECT id, user_id AS userId, action, entity_type AS entityType, entity_id AS entityId, details, ip_address AS ipAddress, request_id AS requestId, created_at AS createdAt FROM audit_logs ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, [...p, limit, offset]);
  return { items, total };
}
module.exports = { insert, list };
