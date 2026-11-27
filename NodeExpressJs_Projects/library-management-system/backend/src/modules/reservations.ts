import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, exec, withTx } from '../lib/db';
import { audit } from '../lib/audit';
import { forbidden, notFound, unprocessable } from '../lib/errors';
import { idParam, ok, page, pagination, parse, wrap } from '../lib/http';
import { getMemberPolicy } from '../lib/membership';
import { releaseReservation } from '../lib/reservations';
import { isStaff, requireActive, requireAuth, staffOnly } from '../middleware/auth';

export const reservationsRouter = Router();
reservationsRouter.use(requireAuth);

const RES_SQL = `
  SELECT r.id, r.user_id AS userId, u.full_name AS memberName, mp.member_code AS memberCode, r.book_id AS bookId, b.title AS bookTitle,
         b.cover_url AS coverUrl, r.status, r.created_at AS createdAt, r.ready_at AS readyAt, r.expires_at AS expiresAt, r.closed_at AS closedAt,
         bc.accession_number AS heldCopy,
         CASE WHEN r.status = 'pending' THEN (SELECT COUNT(*) FROM reservations r2 WHERE r2.book_id = r.book_id AND r2.status = 'pending'
              AND (r2.created_at < r.created_at OR (r2.created_at = r.created_at AND r2.id <= r.id))) ELSE NULL END AS queuePosition,
         (SELECT GROUP_CONCAT(a.name ORDER BY ba.position SEPARATOR ', ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = r.book_id) AS authors
    FROM reservations r
    JOIN users u ON u.id = r.user_id JOIN member_profiles mp ON mp.user_id = r.user_id
    JOIN books b ON b.id = r.book_id LEFT JOIN book_copies bc ON bc.id = r.copy_id`;

function filters(q: Record<string, any>) {
  const where: string[] = []; const args: any[] = [];
  if (q.status === 'open') where.push("r.status IN ('pending','ready')");
  else if (q.status) { where.push('r.status = ?'); args.push(String(q.status)); }
  if (q.q) { const l = `%${String(q.q).replace(/[%_]/g, '\\$&')}%`; where.push('(u.full_name LIKE ? OR mp.member_code LIKE ? OR b.title LIKE ?)'); args.push(l, l, l); }
  if (q.bookId) { where.push('r.book_id = ?'); args.push(Number(q.bookId)); }
  return { where, args };
}

reservationsReadRoutes();
function reservationsReadRoutes() {
  reservationsRouter.get('/', staffOnly, wrap(async (req, res) => {
    const p = pagination(req.query); const { where, args } = filters(req.query);
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${RES_SQL} ${w}) x`, args))!.n;
    page(res, await query(`${RES_SQL} ${w} ORDER BY FIELD(r.status,'ready','pending','fulfilled','expired','cancelled'), r.created_at LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
  }));
  reservationsRouter.get('/mine', wrap(async (req, res) => {
    const p = pagination(req.query); const { where, args } = filters(req.query);
    where.push('r.user_id = ?'); args.push(req.user!.id);
    const w = `WHERE ${where.join(' AND ')}`;
    const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${RES_SQL} ${w}) x`, args))!.n;
    page(res, await query(`${RES_SQL} ${w} ORDER BY FIELD(r.status,'ready','pending','fulfilled','expired','cancelled'), r.created_at DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
  }));
}

// Reserve a book that has no copy available right now.
reservationsRouter.post('/', requireActive, wrap(async (req, res) => {
  const b = parse(z.object({ bookId: z.coerce.number().int().positive(), memberId: z.coerce.number().int().positive().optional() }), req.body);
  const userId = isStaff(req.user) && b.memberId ? b.memberId : req.user!.id;
  if (userId !== req.user!.id && !isStaff(req.user)) throw forbidden();
  const id = await withTx(async (c) => {
    if (!(await queryOne("SELECT id FROM users WHERE id = ? AND role_id = 3 AND status = 'active' FOR UPDATE", [userId], c))) throw unprocessable('Only active members can reserve books');
    const policy = await getMemberPolicy(userId, c);
    if (!policy || policy.expired || policy.membershipStatus === 'suspended') throw unprocessable('Membership is not valid for reservations');
    const book = await queryOne<any>('SELECT id, status FROM books WHERE id = ? FOR UPDATE', [b.bookId], c);
    if (!book || book.status !== 'active') throw notFound('Book');
    if ((await queryOne<any>("SELECT COUNT(*) AS n FROM book_copies WHERE book_id = ? AND status = 'available'", [b.bookId], c))!.n > 0) {
      throw unprocessable('Copies are available right now - ask at the desk to borrow it instead of reserving');
    }
    if ((await queryOne<any>("SELECT COUNT(*) AS n FROM book_copies WHERE book_id = ? AND status IN ('on_loan','held')", [b.bookId], c))!.n === 0) {
      throw unprocessable('This book has no circulating copies, so it cannot be reserved');
    }
    if (await queryOne("SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'", [userId, b.bookId], c)) throw unprocessable('You already have this book on loan');
    if (await queryOne("SELECT 1 FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('pending','ready')", [userId, b.bookId], c)) throw unprocessable('There is already an active reservation for this book');
    const open = (await queryOne<any>("SELECT COUNT(*) AS n FROM reservations WHERE user_id = ? AND status IN ('pending','ready')", [userId], c))!.n;
    if (open >= policy.maxReservations) throw unprocessable(`Reservation limit reached (${policy.maxReservations})`);
    const r = await exec("INSERT INTO reservations (user_id, book_id) VALUES (?, ?)", [userId, b.bookId], c);
    return r.insertId;
  });
  await audit(req, req.user!.id, 'reservation.create', 'reservation', id, { bookId: b.bookId, memberId: userId });
  ok(res, await queryOne(`${RES_SQL} WHERE r.id = ?`, [id]), 201);
}));

reservationsRouter.post('/:id/cancel', wrap(async (req, res) => {
  const id = idParam(req);
  await withTx(async (c) => {
    const r = await queryOne<any>('SELECT id, user_id, status FROM reservations WHERE id = ? FOR UPDATE', [id], c);
    if (!r) throw notFound('Reservation');
    if (r.user_id !== req.user!.id && !isStaff(req.user)) throw forbidden();
    if (!['pending', 'ready'].includes(r.status)) throw unprocessable('Only open reservations can be cancelled');
    await releaseReservation(c, id, 'cancelled');
  });
  await audit(req, req.user!.id, 'reservation.cancel', 'reservation', id);
  ok(res, await queryOne(`${RES_SQL} WHERE r.id = ?`, [id]));
}));
