import { Router } from 'express';
import { query, queryOne } from '../lib/db';
import { ok, wrap } from '../lib/http';
import { requireAuth, staffOnly } from '../middleware/auth';
import { getMemberPolicy } from '../lib/membership';
import { memberBalance } from '../lib/fines';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Everything below is computed from MySQL at request time.
dashboardRouter.get('/staff', staffOnly, wrap(async (req, res) => {
  const isAdmin = req.user!.role === 'admin';
  const n = async (sql: string) => Number((await queryOne<any>(sql))?.n ?? 0);
  const stats = {
    totalBooks: await n("SELECT COUNT(*) AS n FROM books WHERE status = 'active'"),
    totalCopies: await n("SELECT COUNT(*) AS n FROM book_copies bc JOIN books b ON b.id = bc.book_id WHERE bc.status <> 'withdrawn' AND b.status = 'active'"),
    availableCopies: await n("SELECT COUNT(*) AS n FROM book_copies WHERE status = 'available'"),
    borrowedCopies: await n("SELECT COUNT(*) AS n FROM book_copies WHERE status = 'on_loan'"),
    heldCopies: await n("SELECT COUNT(*) AS n FROM book_copies WHERE status = 'held'"),
    damagedOrLostCopies: await n("SELECT COUNT(*) AS n FROM book_copies WHERE status IN ('damaged','lost')"),
    totalMembers: await n('SELECT COUNT(*) AS n FROM users WHERE role_id = 3'),
    activeMembers: await n("SELECT COUNT(*) AS n FROM users WHERE role_id = 3 AND status = 'active'"),
    pendingMembers: await n("SELECT COUNT(*) AS n FROM users WHERE role_id = 3 AND status = 'pending'"),
    activeLoans: await n("SELECT COUNT(*) AS n FROM loans WHERE status = 'active'"),
    overdueLoans: await n("SELECT COUNT(*) AS n FROM loans WHERE status = 'active' AND due_date < UTC_DATE()"),
    pendingReservations: await n("SELECT COUNT(*) AS n FROM reservations WHERE status IN ('pending','ready')"),
    outstandingFines: Number((await queryOne<any>('SELECT COALESCE(SUM(amount - waived_amount - paid_amount), 0) AS n FROM fines'))?.n ?? 0),
    paymentsCollected: Number((await queryOne<any>("SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END), 0) AS n FROM payments"))?.n ?? 0),
    paymentsToday: Number((await queryOne<any>("SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END), 0) AS n FROM payments WHERE DATE(created_at) = UTC_DATE()"))?.n ?? 0),
    pendingReviews: await n("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'"),
  };
  const recentlyIssued = await query(`SELECT l.id, b.title, u.full_name AS member, l.issued_at AS at, l.due_date AS dueDate
    FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id ORDER BY l.issued_at DESC, l.id DESC LIMIT 6`);
  const recentlyReturned = await query(`SELECT l.id, b.title, u.full_name AS member, l.returned_at AS at, l.status
    FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id WHERE l.returned_at IS NOT NULL ORDER BY l.returned_at DESC, l.id DESC LIMIT 6`);
  const popularBooks = await query(`SELECT b.id, b.title, COUNT(*) AS loans FROM loans l JOIN books b ON b.id = l.book_id GROUP BY b.id, b.title ORDER BY loans DESC, b.title LIMIT 6`);
  // last 12 months, zero-filled
  const months: string[] = [];
  const d = new Date(); d.setUTCDate(1);
  for (let i = 11; i >= 0; i--) { const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); months.push(m.toISOString().slice(0, 7)); }
  const loanRows = await query<any>("SELECT DATE_FORMAT(issued_at, '%Y-%m') AS m, COUNT(*) AS n FROM loans WHERE issued_at >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH) GROUP BY m");
  const retRows = await query<any>("SELECT DATE_FORMAT(returned_at, '%Y-%m') AS m, COUNT(*) AS n FROM loans WHERE returned_at >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH) GROUP BY m");
  const memRows = await query<any>("SELECT DATE_FORMAT(created_at, '%Y-%m') AS m, COUNT(*) AS n FROM users WHERE role_id = 3 AND created_at >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH) GROUP BY m");
  const memBefore = await n("SELECT COUNT(*) AS n FROM users WHERE role_id = 3 AND created_at < DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH)");
  const pick = (rows: any[], m: string) => Number(rows.find((r) => r.m === m)?.n ?? 0);
  let cum = memBefore;
  const trends = months.map((m) => { cum += pick(memRows, m); return { month: m, issued: pick(loanRows, m), returned: pick(retRows, m), newMembers: pick(memRows, m), totalMembers: cum }; });
  const categoryShare = await query(`SELECT c.name, COUNT(*) AS loans FROM loans l JOIN book_categories bc ON bc.book_id = l.book_id JOIN categories c ON c.id = bc.category_id GROUP BY c.id, c.name ORDER BY loans DESC LIMIT 6`);
  ok(res, { role: req.user!.role, stats: isAdmin ? stats : { ...stats }, recentlyIssued, recentlyReturned, popularBooks, trends, categoryShare });
}));

dashboardRouter.get('/member', wrap(async (req, res) => {
  const id = req.user!.id;
  const profile = await queryOne<any>(`SELECT u.id, u.full_name AS fullName, u.email, u.status, mp.member_code AS memberCode,
      (SELECT COUNT(*) FROM user_images ui WHERE ui.user_id = u.id) > 0 AS hasPicture
      FROM users u LEFT JOIN member_profiles mp ON mp.user_id = u.id WHERE u.id = ?`, [id]);
  profile.hasPicture = !!profile.hasPicture;
  const loanSql = `SELECT l.id, b.id AS bookId, b.title, b.cover_url AS coverUrl, l.issued_at AS issuedAt, l.due_date AS dueDate, l.returned_at AS returnedAt,
      l.renewal_count AS renewalCount, l.status, (l.status = 'active' AND l.due_date < UTC_DATE()) AS isOverdue,
      DATEDIFF(l.due_date, UTC_DATE()) AS daysLeft FROM loans l JOIN books b ON b.id = l.book_id`;
  const active = (await query<any>(`${loanSql} WHERE l.user_id = ? AND l.status = 'active' ORDER BY l.due_date`, [id])).map((r) => ({ ...r, isOverdue: !!r.isOverdue }));
  const recent = await query(`${loanSql} WHERE l.user_id = ? AND l.status <> 'active' ORDER BY l.returned_at DESC LIMIT 5`, [id]);
  const reservations = await query(`SELECT r.id, b.title, r.status, r.expires_at AS expiresAt, b.id AS bookId FROM reservations r JOIN books b ON b.id = r.book_id WHERE r.user_id = ? AND r.status IN ('pending','ready') ORDER BY r.created_at`, [id]);
  const notifications = await query('SELECT id, type, title, message, link, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 5', [id]);
  const totals = await queryOne<any>("SELECT COUNT(*) AS borrowedAllTime FROM loans WHERE user_id = ?", [id]);
  ok(res, {
    profile, membership: await getMemberPolicy(id), activeLoans: active, overdue: active.filter((l) => l.isOverdue),
    dueSoon: active.filter((l) => !l.isOverdue && l.daysLeft <= 3), recentLoans: recent, reservations,
    outstandingFines: await memberBalance(id), notifications: notifications.map((r: any) => ({ ...r, isRead: !!r.isRead })),
    borrowedAllTime: totals.borrowedAllTime,
  });
}));
