import { Router } from 'express';
import { query, queryOne } from '../lib/db';
import { notFound } from '../lib/errors';
import { ok, page, pagination, wrap } from '../lib/http';
import { toCsv } from '../lib/csv';
import { audit } from '../lib/audit';
import { requireAuth, staffOnly } from '../middleware/auth';

export const reportsRouter = Router();
reportsRouter.use(requireAuth, staffOnly);

interface Filters { from?: string; to?: string; q?: string }
interface Def { title: string; description: string; dateFilter?: boolean; build: (f: Filters) => { sql: string; args: any[] } }
const like = (q: string) => `%${q.replace(/[%_]/g, '\\$&')}%`;
const range = (col: string, f: Filters, args: any[]) => {
  const w: string[] = [];
  if (f.from) { w.push(`${col} >= ?`); args.push(`${f.from} 00:00:00`); }
  if (f.to) { w.push(`${col} <= ?`); args.push(`${f.to} 23:59:59`); }
  return w;
};
const AUTHORS = `(SELECT GROUP_CONCAT(a.name ORDER BY ba.position SEPARATOR '; ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id)`;
const where = (w: string[]) => (w.length ? `WHERE ${w.join(' AND ')}` : '');

// Every report is a parameterised SELECT; the same definitions drive the on-screen table and the CSV export.
export const REPORTS: Record<string, Def> = {
  inventory: {
    title: 'Complete book inventory', description: 'Every book with its copy counts by status.',
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.q) { w.push(`(b.title LIKE ? OR b.isbn13 = ? OR b.isbn10 = ? OR ${AUTHORS} LIKE ?)`); args.push(like(f.q), f.q, f.q, like(f.q)); }
      return { args, sql: `SELECT b.id AS bookId, b.title, ${AUTHORS} AS authors, b.isbn13, p.name AS publisher, b.publication_year AS year, b.language, b.format, b.location, b.status,
        COALESCE(SUM(bc.status <> 'withdrawn'),0) AS totalCopies, COALESCE(SUM(bc.status='available'),0) AS availableCopies, COALESCE(SUM(bc.status='on_loan'),0) AS borrowedCopies,
        COALESCE(SUM(bc.status='held'),0) AS heldCopies, COALESCE(SUM(bc.status='damaged'),0) AS damagedCopies, COALESCE(SUM(bc.status='lost'),0) AS lostCopies
        FROM books b LEFT JOIN publishers p ON p.id = b.publisher_id LEFT JOIN book_copies bc ON bc.book_id = b.id ${where(w)} GROUP BY b.id, p.name ORDER BY b.title` }; },
  },
  availability: {
    title: 'Available and borrowed copies', description: 'Each physical copy with its current status and borrower.',
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.q) { w.push('(b.title LIKE ? OR bc.accession_number LIKE ?)'); args.push(like(f.q), like(f.q)); }
      return { args, sql: `SELECT bc.accession_number AS accession, b.title, bc.status, bc.shelf_location AS shelf, u.full_name AS borrower, l.due_date AS dueDate
        FROM book_copies bc JOIN books b ON b.id = bc.book_id LEFT JOIN loans l ON l.copy_id = bc.id AND l.status = 'active' LEFT JOIN users u ON u.id = l.user_id ${where(w)} ORDER BY b.title, bc.accession_number` }; },
  },
  'books-by-category': {
    title: 'Books by category', description: 'Number of titles and copies in each category.',
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.q) { w.push('c.name LIKE ?'); args.push(like(f.q)); }
      return { args, sql: `SELECT c.name AS category, p.name AS parentCategory, COUNT(DISTINCT bc.book_id) AS titles, COALESCE(SUM(cp.status <> 'withdrawn'), 0) AS copies
        FROM categories c LEFT JOIN categories p ON p.id = c.parent_id LEFT JOIN book_categories bc ON bc.category_id = c.id LEFT JOIN book_copies cp ON cp.book_id = bc.book_id ${where(w)} GROUP BY c.id, p.name ORDER BY c.name` }; },
  },
  'books-by-author': {
    title: 'Books by author', description: 'Titles and copies per author.',
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.q) { w.push('a.name LIKE ?'); args.push(like(f.q)); }
      return { args, sql: `SELECT a.name AS author, a.nationality, COUNT(DISTINCT ba.book_id) AS titles, COALESCE(SUM(cp.status <> 'withdrawn'), 0) AS copies
        FROM authors a LEFT JOIN book_authors ba ON ba.author_id = a.id LEFT JOIN book_copies cp ON cp.book_id = ba.book_id ${where(w)} GROUP BY a.id ORDER BY a.name` }; },
  },
  'books-by-publisher': {
    title: 'Books by publisher', description: 'Titles and copies per publisher.',
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.q) { w.push('p.name LIKE ?'); args.push(like(f.q)); }
      return { args, sql: `SELECT p.name AS publisher, COUNT(DISTINCT b.id) AS titles, COALESCE(SUM(cp.status <> 'withdrawn'), 0) AS copies
        FROM publishers p LEFT JOIN books b ON b.publisher_id = p.id LEFT JOIN book_copies cp ON cp.book_id = b.id ${where(w)} GROUP BY p.id ORDER BY p.name` }; },
  },
  'issue-return-history': {
    title: 'Issue and return history', description: 'All loans issued in the period.', dateFilter: true,
    build: (f) => { const args: any[] = []; const w = range('l.issued_at', f, args);
      if (f.q) { w.push('(b.title LIKE ? OR u.full_name LIKE ? OR mp.member_code LIKE ? OR bc.accession_number LIKE ?)'); args.push(like(f.q), like(f.q), like(f.q), like(f.q)); }
      return { args, sql: `SELECT l.id AS loanId, mp.member_code AS memberCode, u.full_name AS member, b.title, bc.accession_number AS accession, l.issued_at AS issuedAt, l.due_date AS dueDate,
        l.returned_at AS returnedAt, l.status, l.return_condition AS returnCondition, l.renewal_count AS renewals, iss.full_name AS issuedBy, ret.full_name AS returnedProcessedBy
        FROM loans l JOIN users u ON u.id = l.user_id JOIN member_profiles mp ON mp.user_id = u.id JOIN books b ON b.id = l.book_id JOIN book_copies bc ON bc.id = l.copy_id
        LEFT JOIN users iss ON iss.id = l.issued_by LEFT JOIN users ret ON ret.id = l.returned_processed_by ${where(w)} ORDER BY l.issued_at DESC, l.id DESC` }; },
  },
  'current-loans': {
    title: 'Current loans', description: 'Books currently on loan.',
    build: (f) => { const args: any[] = []; const w = ["l.status = 'active'"];
      if (f.q) { w.push('(b.title LIKE ? OR u.full_name LIKE ? OR mp.member_code LIKE ?)'); args.push(like(f.q), like(f.q), like(f.q)); }
      return { args, sql: `SELECT mp.member_code AS memberCode, u.full_name AS member, b.title, bc.accession_number AS accession, l.issued_at AS issuedAt, l.due_date AS dueDate,
        GREATEST(0, DATEDIFF(UTC_DATE(), l.due_date)) AS daysOverdue
        FROM loans l JOIN users u ON u.id = l.user_id JOIN member_profiles mp ON mp.user_id = u.id JOIN books b ON b.id = l.book_id JOIN book_copies bc ON bc.id = l.copy_id ${where(w)} ORDER BY l.due_date` }; },
  },
  'overdue-loans': {
    title: 'Overdue loans', description: 'Active loans past their due date.',
    build: (f) => { const args: any[] = []; const w = ["l.status = 'active'", 'l.due_date < UTC_DATE()'];
      if (f.q) { w.push('(b.title LIKE ? OR u.full_name LIKE ? OR mp.member_code LIKE ?)'); args.push(like(f.q), like(f.q), like(f.q)); }
      return { args, sql: `SELECT mp.member_code AS memberCode, u.full_name AS member, u.email, u.phone, b.title, bc.accession_number AS accession, l.due_date AS dueDate, DATEDIFF(UTC_DATE(), l.due_date) AS daysOverdue
        FROM loans l JOIN users u ON u.id = l.user_id JOIN member_profiles mp ON mp.user_id = u.id JOIN books b ON b.id = l.book_id JOIN book_copies bc ON bc.id = l.copy_id ${where(w)} ORDER BY l.due_date` }; },
  },
  'member-borrowing': {
    title: 'Member borrowing history', description: 'Borrowing per member (search by name, code or email).', dateFilter: true,
    build: (f) => { const args: any[] = []; const w = range('l.issued_at', f, args);
      if (f.q) { w.push('(u.full_name LIKE ? OR mp.member_code LIKE ? OR u.email LIKE ?)'); args.push(like(f.q), like(f.q), like(f.q)); }
      return { args, sql: `SELECT mp.member_code AS memberCode, u.full_name AS member, COUNT(l.id) AS loans, SUM(l.status = 'active') AS active,
        SUM(l.status = 'active' AND l.due_date < UTC_DATE()) AS overdue, MAX(l.issued_at) AS lastBorrowed
        FROM users u JOIN member_profiles mp ON mp.user_id = u.id JOIN loans l ON l.user_id = u.id ${where(w)} GROUP BY u.id, mp.member_code ORDER BY loans DESC, u.full_name` }; },
  },
  'most-borrowed': {
    title: 'Most borrowed books', description: 'Titles ranked by number of loans in the period.', dateFilter: true,
    build: (f) => { const args: any[] = []; const w = range('l.issued_at', f, args);
      if (f.q) { w.push('b.title LIKE ?'); args.push(like(f.q)); }
      return { args, sql: `SELECT b.id AS bookId, b.title, ${AUTHORS} AS authors, COUNT(*) AS loans FROM loans l JOIN books b ON b.id = l.book_id ${where(w)} GROUP BY b.id ORDER BY loans DESC, b.title` }; },
  },
  'inactive-books': {
    title: 'Inactive books', description: 'Active titles never borrowed in the period (or ever, without dates).', dateFilter: true,
    build: (f) => { const args: any[] = []; const r: string[] = range('l.issued_at', f, args); const w = ["b.status = 'active'"];
      w.push(`NOT EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id${r.length ? ' AND ' + r.join(' AND ') : ''})`);
      if (f.q) { w.push('b.title LIKE ?'); args.push(like(f.q)); }
      return { args, sql: `SELECT b.id AS bookId, b.title, ${AUTHORS} AS authors, b.location, b.created_at AS addedAt, (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.id AND c.status <> 'withdrawn') AS copies
        FROM books b ${where(w)} ORDER BY b.created_at` }; },
  },
  'lost-damaged': {
    title: 'Lost and damaged books', description: 'Copies currently marked lost or damaged.',
    build: (f) => { const args: any[] = []; const w = ["bc.status IN ('lost','damaged')"];
      if (f.q) { w.push('(b.title LIKE ? OR bc.accession_number LIKE ?)'); args.push(like(f.q), like(f.q)); }
      return { args, sql: `SELECT bc.accession_number AS accession, b.title, bc.status, bc.condition_notes AS notes, bc.updated_at AS updatedAt,
        (SELECT u.full_name FROM loans l JOIN users u ON u.id = l.user_id WHERE l.copy_id = bc.id ORDER BY l.id DESC LIMIT 1) AS lastBorrower
        FROM book_copies bc JOIN books b ON b.id = bc.book_id ${where(w)} ORDER BY bc.updated_at DESC` }; },
  },
  'outstanding-dues': {
    title: 'Outstanding dues', description: 'Unpaid fine balances by member.',
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.q) { w.push('(u.full_name LIKE ? OR mp.member_code LIKE ?)'); args.push(like(f.q), like(f.q)); }
      return { args, sql: `SELECT * FROM (SELECT mp.member_code AS memberCode, u.full_name AS member, u.email, COUNT(*) AS openFines,
        ROUND(SUM(f.amount - f.waived_amount - f.paid_amount), 2) AS outstanding FROM fines f JOIN users u ON u.id = f.user_id JOIN member_profiles mp ON mp.user_id = u.id
        WHERE f.status IN ('outstanding','partial') ${w.length ? 'AND ' + w.join(' AND ') : ''} GROUP BY u.id, mp.member_code) t ORDER BY outstanding DESC` }; },
  },
  'fine-collection': {
    title: 'Fine collection', description: 'Fines raised, waived and collected by type in the period.', dateFilter: true,
    build: (f) => { const args: any[] = []; const w = range('f.created_at', f, args);
      return { args, sql: `SELECT f.fine_type AS fineType, COUNT(*) AS fines, ROUND(SUM(f.amount), 2) AS raised, ROUND(SUM(f.waived_amount), 2) AS waived,
        ROUND(SUM(f.paid_amount), 2) AS collected, ROUND(SUM(f.amount - f.waived_amount - f.paid_amount), 2) AS outstanding FROM fines f ${where(w)} GROUP BY f.fine_type ORDER BY raised DESC` }; },
  },
  'payment-history': {
    title: 'Payment history', description: 'Payments and reversals in the period.', dateFilter: true,
    build: (f) => { const args: any[] = []; const w = range('p.created_at', f, args);
      if (f.q) { w.push('(u.full_name LIKE ? OR mp.member_code LIKE ? OR p.receipt_number LIKE ?)'); args.push(like(f.q), like(f.q), like(f.q)); }
      return { args, sql: `SELECT p.receipt_number AS receipt, p.created_at AS paidAt, mp.member_code AS memberCode, u.full_name AS member, p.kind, p.amount, p.method, p.reference, rb.full_name AS receivedBy
        FROM payments p JOIN users u ON u.id = p.user_id JOIN member_profiles mp ON mp.user_id = u.id LEFT JOIN users rb ON rb.id = p.received_by ${where(w)} ORDER BY p.created_at DESC, p.id DESC` }; },
  },
  'membership-registrations': {
    title: 'Membership registrations', description: 'Members registered in the period.', dateFilter: true,
    build: (f) => { const args: any[] = []; const w = range('u.created_at', f, args);
      if (f.q) { w.push('(u.full_name LIKE ? OR u.email LIKE ? OR mp.member_code LIKE ?)'); args.push(like(f.q), like(f.q), like(f.q)); }
      return { args, sql: `SELECT mp.member_code AS memberCode, u.full_name AS member, u.email, t.name AS membershipType, u.status, u.created_at AS registeredAt
        FROM users u JOIN member_profiles mp ON mp.user_id = u.id LEFT JOIN memberships m ON m.id = (SELECT m2.id FROM memberships m2 WHERE m2.user_id = u.id ORDER BY m2.id LIMIT 1)
        LEFT JOIN member_types t ON t.id = m.member_type_id ${where(w)} ORDER BY u.created_at DESC` }; },
  },
  'membership-expirations': {
    title: 'Membership expirations', description: 'Current memberships ending in the period (defaults to the next 60 days).', dateFilter: true,
    build: (f) => { const args: any[] = []; const w: string[] = [];
      if (f.from) { w.push('m.end_date >= ?'); args.push(f.from); } else w.push('m.end_date >= UTC_DATE()');
      if (f.to) { w.push('m.end_date <= ?'); args.push(f.to); } else w.push('m.end_date <= DATE_ADD(UTC_DATE(), INTERVAL 60 DAY)');
      w.push('m.id = (SELECT m2.id FROM memberships m2 WHERE m2.user_id = m.user_id AND m2.status <> \'cancelled\' ORDER BY m2.end_date DESC, m2.id DESC LIMIT 1)');
      if (f.q) { w.push('(u.full_name LIKE ? OR mp.member_code LIKE ?)'); args.push(like(f.q), like(f.q)); }
      return { args, sql: `SELECT mp.member_code AS memberCode, u.full_name AS member, u.email, t.name AS membershipType, m.end_date AS expiresOn, m.status
        FROM memberships m JOIN users u ON u.id = m.user_id JOIN member_profiles mp ON mp.user_id = u.id JOIN member_types t ON t.id = m.member_type_id ${where(w)} ORDER BY m.end_date` }; },
  },
};

reportsRouter.get('/', wrap(async (_req, res) => {
  ok(res, Object.entries(REPORTS).map(([key, d]) => ({ key, title: d.title, description: d.description, dateFilter: !!d.dateFilter })));
}));

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

reportsRouter.get('/:name', wrap(async (req, res) => {
  const def = REPORTS[req.params.name];
  if (!def) throw notFound('Report');
  const f: Filters = { from: isDate(req.query.from) ? req.query.from : undefined, to: isDate(req.query.to) ? req.query.to : undefined, q: String(req.query.q ?? '').trim() || undefined };
  const { sql, args } = def.build(f);
  if (req.query.format === 'csv') {
    const rows = await query<any>(`${sql} LIMIT 50000`, args);
    await audit(req, req.user!.id, 'report.export', 'report', req.params.name, { rows: rows.length });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${req.params.name}-${new Date().toISOString().slice(0, 10)}.csv"` });
    return void res.send(toCsv(rows));
  }
  const p = pagination(req.query, 25, 200);
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${sql}) x`, args))!.n;
  const rows = await query(`${sql} LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]);
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const r = res as any;
  page(r, rows, p, total);
  void columns;
}));
