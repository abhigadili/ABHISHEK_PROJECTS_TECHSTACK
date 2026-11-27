import { Router } from 'express';
import { z } from 'zod';
import { exec, query, queryOne } from '../lib/db';
import { audit } from '../lib/audit';
import { forbidden, notFound, unprocessable } from '../lib/errors';
import { idParam, ok, page, pagination, parse, wrap, optStr } from '../lib/http';
import { getSettings } from '../lib/settings';
import { isStaff, requireActive, requireAuth, staffOnly } from '../middleware/auth';

// ===== Notifications (stored in MySQL) =====================================================
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
const NOTE_COLS = 'id, type, title, message, link, is_read AS isRead, read_at AS readAt, created_at AS createdAt';

notificationsRouter.get('/', wrap(async (req, res) => {
  const p = pagination(req.query, 20);
  const unreadOnly = req.query.unread === '1';
  const w = `WHERE user_id = ?${unreadOnly ? ' AND is_read = 0' : ''}`;
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM notifications ${w}`, [req.user!.id]))!.n;
  const rows = await query(`SELECT ${NOTE_COLS} FROM notifications ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [req.user!.id, p.pageSize, p.offset]);
  const unread = (await queryOne<any>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user!.id]))!.n;
  res.json({ data: rows.map((r: any) => ({ ...r, isRead: !!r.isRead })), meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)), unread } });
}));
notificationsRouter.get('/unread-count', wrap(async (req, res) => {
  ok(res, { unread: (await queryOne<any>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user!.id]))!.n });
}));
notificationsRouter.post('/read-all', wrap(async (req, res) => {
  const r = await exec('UPDATE notifications SET is_read = 1, read_at = UTC_TIMESTAMP() WHERE user_id = ? AND is_read = 0', [req.user!.id]);
  ok(res, { updated: r.affectedRows });
}));
notificationsRouter.post('/:id/read', wrap(async (req, res) => {
  const id = idParam(req);
  const r = await exec('UPDATE notifications SET is_read = 1, read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = ? AND user_id = ?', [id, req.user!.id]);
  if (!r.affectedRows) throw notFound('Notification');
  ok(res, { read: true });
}));

// ===== Favorites / reading list ============================================================
export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);
favoritesRouter.get('/', wrap(async (req, res) => {
  ok(res, await query(`SELECT b.id, b.title, b.cover_url AS coverUrl, f.created_at AS addedAt,
      (SELECT GROUP_CONCAT(a.name ORDER BY ba.position SEPARATOR ', ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id) AS authors,
      (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id AND bc.status = 'available') AS availableCopies
    FROM favorites f JOIN books b ON b.id = f.book_id WHERE f.user_id = ? AND b.status = 'active' ORDER BY f.created_at DESC`, [req.user!.id]));
}));
favoritesRouter.put('/:bookId', wrap(async (req, res) => {
  const bookId = idParam(req, 'bookId');
  if (!(await queryOne("SELECT 1 FROM books WHERE id = ? AND status = 'active'", [bookId]))) throw notFound('Book');
  await exec('INSERT IGNORE INTO favorites (user_id, book_id) VALUES (?,?)', [req.user!.id, bookId]);
  ok(res, { isFavorite: true });
}));
favoritesRouter.delete('/:bookId', wrap(async (req, res) => {
  await exec('DELETE FROM favorites WHERE user_id = ? AND book_id = ?', [req.user!.id, idParam(req, 'bookId')]);
  ok(res, { isFavorite: false });
}));

// ===== Reviews & ratings (optional moderation) ==============================================
export const reviewsRouter = Router();
reviewsRouter.get('/book/:bookId', wrap(async (req, res) => {
  const bookId = idParam(req, 'bookId');
  const rows = await query(`SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, u.full_name AS author, r.user_id AS userId, r.status
      FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.book_id = ? AND (r.status = 'approved' OR r.user_id = ?) ORDER BY r.created_at DESC`, [bookId, req.user?.id ?? 0]);
  ok(res, rows);
}));
reviewsRouter.put('/book/:bookId', requireActive, wrap(async (req, res) => {
  const bookId = idParam(req, 'bookId');
  if (req.user!.role !== 'member') throw forbidden('Only members can review books');
  const b = parse(z.object({ rating: z.coerce.number().int().min(1).max(5), comment: optStr(2000) }), req.body);
  if (!(await queryOne("SELECT 1 FROM books WHERE id = ? AND status = 'active'", [bookId]))) throw notFound('Book');
  // Reviews are limited to members who have borrowed the book.
  if (!(await queryOne('SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? LIMIT 1', [req.user!.id, bookId]))) throw unprocessable('You can review a book after borrowing it');
  const status = (await getSettings()).review_moderation ? 'pending' : 'approved';
  await exec(`INSERT INTO reviews (user_id, book_id, rating, comment, status) VALUES (?,?,?,?,?)
    ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), status = VALUES(status)`, [req.user!.id, bookId, b.rating, b.comment, status]);
  ok(res, { status });
}));
reviewsRouter.delete('/:id', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  const r = await queryOne<any>('SELECT user_id FROM reviews WHERE id = ?', [id]);
  if (!r) throw notFound('Review');
  if (r.user_id !== req.user!.id && !isStaff(req.user)) throw forbidden();
  await exec('DELETE FROM reviews WHERE id = ?', [id]);
  if (r.user_id !== req.user!.id) await audit(req, req.user!.id, 'review.delete', 'review', id);
  ok(res, { deleted: true });
}));
// Moderation queue (staff).
reviewsRouter.get('/', requireAuth, staffOnly, wrap(async (req, res) => {
  const p = pagination(req.query);
  const status = String(req.query.status ?? 'pending');
  const total = (await queryOne<any>('SELECT COUNT(*) AS n FROM reviews WHERE status = ?', [status]))!.n;
  page(res, await query(`SELECT r.id, r.rating, r.comment, r.status, r.created_at AS createdAt, u.full_name AS author, b.title AS bookTitle, r.book_id AS bookId
    FROM reviews r JOIN users u ON u.id = r.user_id JOIN books b ON b.id = r.book_id WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [status, p.pageSize, p.offset]), p, total);
}));
reviewsRouter.post('/:id/moderate', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ status: z.enum(['approved', 'rejected']) }), req.body);
  const r = await exec('UPDATE reviews SET status = ? WHERE id = ?', [b.status, id]);
  if (!r.affectedRows) throw notFound('Review');
  await audit(req, req.user!.id, `review.${b.status}`, 'review', id);
  ok(res, { status: b.status });
}));

// ===== Library settings & audit log ========================================================
export const settingsRouter = Router();
// Contact/about information is public; policy values are staff-readable, admin-editable.
settingsRouter.get('/public', wrap(async (_req, res) => {
  const s = await getSettings();
  ok(res, { name: s.library_name, address: s.library_address, phone: s.library_phone, email: s.library_email, hours: s.library_hours, about: s.library_about, currency: s.currency_symbol });
}));
settingsRouter.get('/', requireAuth, staffOnly, wrap(async (_req, res) => {
  ok(res, await query('SELECT setting_key AS `key`, value, value_type AS type, category, description, updated_at AS updatedAt FROM library_settings ORDER BY category, setting_key'));
}));
settingsRouter.put('/', requireAuth, wrap(async (req, res) => {
  if (req.user!.role !== 'admin') throw forbidden();
  const b = parse(z.object({ settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) }), req.body);
  const existing = await query<any>('SELECT setting_key, value_type FROM library_settings');
  const types = new Map(existing.map((r: any) => [r.setting_key, r.value_type]));
  const changed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b.settings)) {
    const type = types.get(k);
    if (!type) throw unprocessable(`Unknown setting: ${k}`);
    let val = String(v);
    if (type === 'number') { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw unprocessable(`${k} must be a non-negative number`); val = String(n); }
    if (type === 'boolean') { if (!['true', 'false'].includes(val)) throw unprocessable(`${k} must be true or false`); }
    if (val.length > 1000) throw unprocessable(`${k} is too long`);
    await exec('UPDATE library_settings SET value = ?, updated_by = ? WHERE setting_key = ?', [val, req.user!.id, k]);
    changed[k] = val;
  }
  await audit(req, req.user!.id, 'settings.update', 'settings', null, changed);
  ok(res, { updated: Object.keys(changed) });
}));

export const auditRouter = Router();
auditRouter.get('/', requireAuth, wrap(async (req, res) => {
  if (req.user!.role !== 'admin') throw forbidden();
  const p = pagination(req.query, 25);
  const where: string[] = []; const args: any[] = [];
  if (req.query.action) { where.push('a.action LIKE ?'); args.push(`${String(req.query.action).replace(/[%_]/g, '\\$&')}%`); }
  if (req.query.entityType) { where.push('a.entity_type = ?'); args.push(String(req.query.entityType)); }
  if (req.query.actorId) { where.push('a.actor_id = ?'); args.push(Number(req.query.actorId)); }
  if (req.query.from) { where.push('a.created_at >= ?'); args.push(`${req.query.from} 00:00:00`); }
  if (req.query.to) { where.push('a.created_at <= ?'); args.push(`${req.query.to} 23:59:59`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM audit_logs a ${w}`, args))!.n;
  page(res, await query(`SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.details, a.ip_address AS ip, a.created_at AS createdAt,
      a.actor_id AS actorId, u.full_name AS actorName FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${w}
      ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
}));
