const { query } = require('../config/database');

const MAP = 'id, user_id AS userId, type, title, message, ref_type AS refType, ref_id AS refId, is_read AS isRead, read_at AS readAt, created_at AS createdAt';
const norm = (r) => (r ? { ...r, isRead: !!r.isRead } : r);

const insert = ({ userId, type, title, message, refType, refId }, conn) =>
  query('INSERT INTO notifications (user_id, type, title, message, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, type, title, message, refType || null, refId || null], conn);

const findById = async (id) => norm((await query(`SELECT ${MAP} FROM notifications WHERE id = ?`, [id]))[0]);

async function listForUser(userId, { unreadOnly, limit, offset }) {
  const w = unreadOnly ? 'AND is_read = 0' : '';
  const total = (await query(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? ${w}`, [userId]))[0].c;
  const rows = await query(`SELECT ${MAP} FROM notifications WHERE user_id = ? ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, [userId, limit, offset]);
  return { items: rows.map(norm), total };
}

/** ids = null marks all of the user's unread notifications. Scoped to the owner. */
async function markRead(userId, ids) {
  const idClause = ids ? 'AND id IN (?)' : '';
  const params = ids ? [userId, ids] : [userId];
  const r = await query(`UPDATE notifications SET is_read = 1, read_at = UTC_TIMESTAMP() WHERE user_id = ? AND is_read = 0 ${idClause}`, params);
  return r.affectedRows;
}
const unreadCount = async (userId) => (await query('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]))[0].c;

module.exports = { insert, findById, listForUser, markRead, unreadCount };
