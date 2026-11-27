import { Router } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { exec, query, queryOne, withTx } from '../lib/db';
import { addDays, diffDays, todayStr } from '../lib/dates';
import { audit } from '../lib/audit';
import { forbidden, notFound, unprocessable } from '../lib/errors';
import { idParam, ok, page, pagination, parse, wrap, optStr, isoDate } from '../lib/http';
import { calculateOverdueFine, createFine, memberBalance } from '../lib/fines';
import { getMemberPolicy, MemberPolicy } from '../lib/membership';
import { notify } from '../lib/notify';
import { allocateForBook } from '../lib/reservations';
import { getSettings, Settings } from '../lib/settings';
import { isStaff, requireActive, requireAuth, staffOnly } from '../middleware/auth';

export const loansRouter = Router();
loansRouter.use(requireAuth);

const LOAN_SQL = `
  SELECT l.id, l.user_id AS userId, u.full_name AS memberName, mp.member_code AS memberCode,
         l.book_id AS bookId, b.title AS bookTitle, b.isbn13, l.copy_id AS copyId, bc.accession_number AS accessionNumber,
         l.issued_at AS issuedAt, l.due_date AS dueDate, l.returned_at AS returnedAt, l.renewal_count AS renewalCount,
         l.status, l.return_condition AS returnCondition, l.notes,
         iss.full_name AS issuedBy, ret.full_name AS returnedProcessedBy,
         (l.status = 'active' AND l.due_date < UTC_DATE()) AS isOverdue,
         CASE WHEN l.status = 'active' THEN GREATEST(0, DATEDIFF(UTC_DATE(), l.due_date)) ELSE GREATEST(0, DATEDIFF(DATE(l.returned_at), l.due_date)) END AS daysLate,
         t.fine_per_day AS finePerDay, t.grace_days AS graceDays, t.max_fine_per_loan AS maxFinePerLoan,
         (SELECT GROUP_CONCAT(a.name ORDER BY ba.position SEPARATOR ', ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = l.book_id) AS authors
    FROM loans l
    JOIN users u ON u.id = l.user_id
    JOIN member_profiles mp ON mp.user_id = l.user_id
    JOIN books b ON b.id = l.book_id
    JOIN book_copies bc ON bc.id = l.copy_id
    LEFT JOIN users iss ON iss.id = l.issued_by
    LEFT JOIN users ret ON ret.id = l.returned_processed_by
    LEFT JOIN memberships ms ON ms.id = (SELECT m2.id FROM memberships m2 WHERE m2.user_id = l.user_id AND m2.status <> 'cancelled' ORDER BY m2.end_date DESC, m2.id DESC LIMIT 1)
    LEFT JOIN member_types t ON t.id = ms.member_type_id`;

function shapeLoan(r: any) {
  const isOverdue = !!r.isOverdue;
  let estimatedFine = 0;
  if (r.status === 'active' && isOverdue && r.finePerDay !== null) {
    estimatedFine = calculateOverdueFine({ dueDate: r.dueDate, returnDate: todayStr(), finePerDay: r.finePerDay, graceDays: r.graceDays, maxFinePerLoan: r.maxFinePerLoan }).amount;
  }
  const { finePerDay, graceDays, maxFinePerLoan, ...rest } = r;
  return { ...rest, isOverdue, daysLate: r.status === 'active' && !isOverdue ? 0 : Number(r.daysLate), estimatedFine,
    displayStatus: r.status === 'active' ? (isOverdue ? 'overdue' : 'active') : r.status };
}

function loanFilters(q: Record<string, any>) {
  const where: string[] = []; const args: any[] = [];
  const s = String(q.status ?? '');
  if (s === 'active') where.push("l.status = 'active'");
  else if (s === 'overdue') where.push("l.status = 'active' AND l.due_date < UTC_DATE()");
  else if (s === 'returned') where.push("l.status = 'returned'");
  else if (s === 'lost') where.push("l.status = 'lost'");
  else if (s === 'closed') where.push("l.status IN ('returned','lost')");
  if (q.q) {
    const l = `%${String(q.q).replace(/[%_]/g, '\\$&')}%`;
    where.push('(u.full_name LIKE ? OR mp.member_code LIKE ? OR b.title LIKE ? OR bc.accession_number LIKE ? OR b.isbn13 = ?)');
    args.push(l, l, l, l, String(q.q).replace(/-/g, ''));
  }
  if (q.memberId) { where.push('l.user_id = ?'); args.push(Number(q.memberId)); }
  if (q.bookId) { where.push('l.book_id = ?'); args.push(Number(q.bookId)); }
  if (q.from) { where.push('l.issued_at >= ?'); args.push(`${q.from} 00:00:00`); }
  if (q.to) { where.push('l.issued_at <= ?'); args.push(`${q.to} 23:59:59`); }
  return { w: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

// Staff: all loans.
loansRouter.get('/', staffOnly, wrap(async (req, res) => {
  const p = pagination(req.query);
  const { w, args } = loanFilters(req.query);
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${LOAN_SQL} ${w}) x`, args))!.n;
  const order = req.query.status === 'overdue' ? 'l.due_date ASC' : 'l.issued_at DESC, l.id DESC';
  page(res, (await query(`${LOAN_SQL} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset])).map(shapeLoan), p, total);
}));

// A member's own loans (staff may pass ?memberId=).
loansRouter.get('/mine', wrap(async (req, res) => {
  const p = pagination(req.query);
  const { w, args } = loanFilters({ ...req.query, memberId: undefined });
  const mine = `${w ? w + ' AND' : 'WHERE'} l.user_id = ?`;
  const uid = isStaff(req.user) && req.query.memberId ? Number(req.query.memberId) : req.user!.id;
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${LOAN_SQL} ${mine}) x`, [...args, uid]))!.n;
  const order = req.query.status === 'active' ? 'l.due_date ASC' : 'l.issued_at DESC, l.id DESC';
  page(res, (await query(`${LOAN_SQL} ${mine} ORDER BY ${order} LIMIT ? OFFSET ?`, [...args, uid, p.pageSize, p.offset])).map(shapeLoan), p, total);
}));

loansRouter.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const row = await queryOne<any>(`${LOAN_SQL} WHERE l.id = ?`, [id]);
  if (!row) throw notFound('Loan');
  if (!isStaff(req.user) && row.userId !== req.user!.id) throw forbidden();
  const loan: any = shapeLoan(row);
  loan.renewals = await query(`SELECT r.id, r.old_due_date AS oldDueDate, r.new_due_date AS newDueDate, r.renewed_at AS renewedAt, u.full_name AS renewedBy
    FROM loan_renewals r LEFT JOIN users u ON u.id = r.renewed_by WHERE r.loan_id = ? ORDER BY r.id`, [id]);
  loan.fines = await query('SELECT id, fine_type AS fineType, amount, waived_amount AS waivedAmount, paid_amount AS paidAmount, status FROM fines WHERE loan_id = ?', [id]);
  ok(res, loan);
}));

// ---- Eligibility ---------------------------------------------------------------------------
export async function assertCanBorrow(c: PoolConnection, userId: number, s: Settings, opts: { forRenewal?: boolean } = {}): Promise<MemberPolicy> {
  const u = await queryOne<any>('SELECT status FROM users WHERE id = ? AND role_id = 3', [userId], c);
  if (!u) throw notFound('Member');
  if (u.status !== 'active') throw unprocessable(`Member account is ${u.status} and cannot borrow`);
  const policy = await getMemberPolicy(userId, c);
  if (!policy) throw unprocessable('Member has no membership');
  if (policy.membershipStatus === 'suspended') throw unprocessable('Membership is suspended');
  if (policy.expired) throw unprocessable(`Membership expired on ${policy.endDate}. Renew it before borrowing.`);
  if (s.block_borrowing_if_overdue) {
    const od = (await queryOne<any>("SELECT COUNT(*) AS n FROM loans WHERE user_id = ? AND status = 'active' AND due_date < UTC_DATE()", [userId], c))!.n;
    if (od) throw unprocessable(`Member has ${od} overdue loan(s). Return them first.`);
  }
  const bal = await memberBalance(userId, c);
  if (bal >= s.max_outstanding_balance && bal > 0) throw unprocessable(`Outstanding fines (${bal.toFixed(2)}) reached the limit of ${s.max_outstanding_balance.toFixed(2)}. Please pay first.`);
  if (!opts.forRenewal) {
    const n = (await queryOne<any>("SELECT COUNT(*) AS n FROM loans WHERE user_id = ? AND status = 'active'", [userId], c))!.n;
    if (n >= policy.maxLoans) throw unprocessable(`Borrowing limit reached (${n}/${policy.maxLoans} loans)`);
  }
  return policy;
}

// ---- Issue ---------------------------------------------------------------------------------
const issueSchema = z.object({
  memberId: z.coerce.number().int().positive().optional(),
  memberCode: z.string().trim().optional(),
  copyId: z.coerce.number().int().positive().optional(),
  accessionNumber: z.string().trim().optional(),
  bookId: z.coerce.number().int().positive().optional(),
  dueDate: isoDate.optional(),
  notes: optStr(255),
}).refine((d) => d.memberId || d.memberCode, { message: 'Member is required', path: ['memberId'] })
  .refine((d) => d.copyId || d.accessionNumber || d.bookId, { message: 'Choose a book or copy', path: ['bookId'] });

loansRouter.post('/issue', staffOnly, wrap(async (req, res) => {
  const b = parse(issueSchema, req.body);
  const staffId = req.user!.id;
  const loanId = await withTx(async (c) => {
    let memberId = b.memberId;
    if (!memberId) {
      const m = await queryOne<any>('SELECT user_id FROM member_profiles WHERE member_code = ?', [b.memberCode!], c);
      if (!m) throw notFound('Member');
      memberId = m.user_id as number;
    }
    // Serialise concurrent issues to the same member so the borrowing limit cannot be raced.
    if (!(await queryOne('SELECT id FROM users WHERE id = ? FOR UPDATE', [memberId], c))) throw notFound('Member');
    const s = await getSettings(c);
    const policy = await assertCanBorrow(c, memberId, s);

    // Resolve + lock the physical copy.
    let copy: any;
    if (b.copyId || b.accessionNumber) {
      copy = await queryOne<any>(`SELECT bc.id, bc.book_id, bc.status FROM book_copies bc WHERE ${b.copyId ? 'bc.id = ?' : 'bc.accession_number = ?'} FOR UPDATE`, [b.copyId ?? b.accessionNumber!], c);
      if (!copy) throw notFound('Copy');
    } else {
      // prefer a copy already held for this member, then any available copy
      copy = await queryOne<any>(`SELECT bc.id, bc.book_id, bc.status FROM book_copies bc JOIN reservations r ON r.copy_id = bc.id AND r.status = 'ready' AND r.user_id = ?
        WHERE bc.book_id = ? AND bc.status = 'held' LIMIT 1 FOR UPDATE`, [memberId, b.bookId!], c)
        ?? await queryOne<any>("SELECT id, book_id, status FROM book_copies WHERE book_id = ? AND status = 'available' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED", [b.bookId!], c);
      if (!copy) throw unprocessable('No copy of this book is available. Reserve it for the member instead.');
    }
    const book = await queryOne<any>('SELECT id, title, status FROM books WHERE id = ?', [copy.book_id], c);
    if (book.status !== 'active') throw unprocessable('This book is archived and cannot be issued');
    if (b.bookId && copy.book_id !== b.bookId) throw unprocessable('Copy does not belong to the selected book');

    const myRes = await queryOne<any>("SELECT id, status, copy_id FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('pending','ready') FOR UPDATE", [memberId, copy.book_id], c);
    if (copy.status === 'held') {
      if (!myRes || myRes.status !== 'ready' || myRes.copy_id !== copy.id) throw unprocessable('This copy is being held for another member');
    } else if (copy.status !== 'available') {
      throw unprocessable(`This copy is not available (status: ${copy.status.replace('_', ' ')})`);
    }
    if (await queryOne("SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'", [memberId, copy.book_id], c)) {
      throw unprocessable('Member already has this book on loan');
    }

    const today = todayStr();
    const due = b.dueDate ?? addDays(today, policy.loanDays);
    if (diffDays(today, due) < 1 || diffDays(today, due) > 365) throw unprocessable('Due date must be within the next 365 days');

    const r = await exec(`INSERT INTO loans (user_id, book_id, copy_id, due_date, issued_by, reservation_id, notes) VALUES (?,?,?,?,?,?,?)`,
      [memberId, copy.book_id, copy.id, due, staffId, myRes?.id ?? null, b.notes], c);
    await exec("UPDATE book_copies SET status = 'on_loan' WHERE id = ?", [copy.id], c);
    if (myRes) {
      await exec("UPDATE reservations SET status = 'fulfilled', closed_at = UTC_TIMESTAMP() WHERE id = ?", [myRes.id], c);
      if (myRes.status === 'ready' && myRes.copy_id && myRes.copy_id !== copy.id) {
        await exec("UPDATE book_copies SET status = 'available' WHERE id = ? AND status = 'held'", [myRes.copy_id], c);
        await allocateForBook(c, copy.book_id);
      }
    }
    await notify(memberId, 'loan_issued', 'Book issued', `"${book.title}" is due on ${due}.`, '/member/loans', c);
    return r.insertId;
  });
  await audit(req, staffId, 'loan.issue', 'loan', loanId);
  ok(res, shapeLoan(await queryOne(`${LOAN_SQL} WHERE l.id = ?`, [loanId])), 201);
}));

// ---- Return --------------------------------------------------------------------------------
const returnSchema = z.object({
  loanId: z.coerce.number().int().positive().optional(),
  accessionNumber: z.string().trim().optional(),
  condition: z.enum(['good', 'damaged', 'lost']).default('good'),
  damageCharge: z.coerce.number().min(0).max(100000).optional(),
  notes: optStr(255),
}).refine((d) => d.loanId || d.accessionNumber, { message: 'Loan or accession number is required', path: ['loanId'] });

export async function processReturn(c: PoolConnection, loanId: number, b: { condition: 'good' | 'damaged' | 'lost'; damageCharge?: number; notes?: string | null }, staffId: number) {
  const loan = await queryOne<any>('SELECT * FROM loans WHERE id = ? FOR UPDATE', [loanId], c);
  if (!loan) throw notFound('Loan');
  if (loan.status !== 'active') throw unprocessable('This loan has already been closed');
  const copy = await queryOne<any>('SELECT id, book_id FROM book_copies WHERE id = ? FOR UPDATE', [loan.copy_id], c);
  const book = await queryOne<any>('SELECT id, title, acquisition_cost FROM books WHERE id = ?', [loan.book_id], c);
  const s = await getSettings(c);
  const policy = await getMemberPolicy(loan.user_id, c);
  const today = todayStr();
  const fines: { type: string; amount: number }[] = [];

  const od = calculateOverdueFine({ dueDate: loan.due_date, returnDate: today, finePerDay: policy?.finePerDay ?? 0, graceDays: policy?.graceDays ?? 0, maxFinePerLoan: policy?.maxFinePerLoan ?? null });
  if (od.amount > 0) {
    await createFine(c, { userId: loan.user_id, loanId, type: 'overdue', amount: od.amount, createdBy: staffId,
      reason: `Overdue ${od.daysOverdue} day(s) for "${book.title}" (${od.chargeableDays} chargeable)` });
    fines.push({ type: 'overdue', amount: od.amount });
  }
  if (b.condition === 'lost') {
    const base = book.acquisition_cost ?? s.lost_book_default_charge;
    const amount = Math.round((base + s.lost_book_processing_fee) * 100) / 100;
    await createFine(c, { userId: loan.user_id, loanId, type: 'lost', amount, createdBy: staffId, reason: `Lost book: "${book.title}"` });
    fines.push({ type: 'lost', amount });
    await exec("UPDATE book_copies SET status = 'lost' WHERE id = ?", [copy.id], c);
  } else if (b.condition === 'damaged') {
    const amount = b.damageCharge ?? s.damage_default_charge;
    await createFine(c, { userId: loan.user_id, loanId, type: 'damage', amount, createdBy: staffId, reason: `Damaged book: "${book.title}"` });
    if (amount > 0) fines.push({ type: 'damage', amount });
    await exec("UPDATE book_copies SET status = 'damaged' WHERE id = ?", [copy.id], c);
  } else {
    await exec("UPDATE book_copies SET status = 'available' WHERE id = ?", [copy.id], c);
  }
  await exec(`UPDATE loans SET status = ?, returned_at = UTC_TIMESTAMP(), return_condition = ?, returned_processed_by = ?, notes = COALESCE(?, notes) WHERE id = ?`,
    [b.condition === 'lost' ? 'lost' : 'returned', b.condition, staffId, b.notes ?? null, loanId], c);
  // queue: a returned good copy goes to the next member waiting
  await allocateForBook(c, loan.book_id);
  await notify(loan.user_id, 'loan_returned', 'Book returned',
    `"${book.title}" was ${b.condition === 'lost' ? 'recorded as lost' : 'returned'}.${fines.length ? ' Fines were added to your account.' : ''}`, '/member/loans', c);
  return { loanId, fines, daysOverdue: od.daysOverdue };
}

loansRouter.post('/return', staffOnly, wrap(async (req, res) => {
  const b = parse(returnSchema, req.body);
  const result = await withTx(async (c) => {
    let id = b.loanId;
    if (!id) {
      const l = await queryOne<any>("SELECT l.id FROM loans l JOIN book_copies bc ON bc.id = l.copy_id WHERE bc.accession_number = ? AND l.status = 'active'", [b.accessionNumber!], c);
      if (!l) throw notFound('Active loan for that accession number');
      id = l.id as number;
    }
    return processReturn(c, id!, b, req.user!.id);
  });
  await audit(req, req.user!.id, `loan.return.${b.condition}`, 'loan', result.loanId, { fines: result.fines });
  const loan: any = shapeLoan(await queryOne(`${LOAN_SQL} WHERE l.id = ?`, [result.loanId]));
  ok(res, { loan, fines: result.fines, daysOverdue: result.daysOverdue });
}));

// ---- Renew ---------------------------------------------------------------------------------
loansRouter.post('/:id/renew', requireActive, wrap(async (req, res) => {
  const id = idParam(req);
  const staff = isStaff(req.user);
  const result = await withTx(async (c) => {
    const loan = await queryOne<any>('SELECT * FROM loans WHERE id = ? FOR UPDATE', [id], c);
    if (!loan) throw notFound('Loan');
    if (!staff && loan.user_id !== req.user!.id) throw forbidden();
    if (loan.status !== 'active') throw unprocessable('Only active loans can be renewed');
    const s = await getSettings(c);
    const policy = await assertCanBorrow(c, loan.user_id, s, { forRenewal: true });
    if (loan.renewal_count >= policy.maxRenewals) throw unprocessable(`Renewal limit reached (${policy.maxRenewals})`);
    if (loan.due_date < todayStr() && s.block_borrowing_if_overdue) throw unprocessable('Overdue loans cannot be renewed. Please return the book.');
    const waiting = (await queryOne<any>("SELECT COUNT(*) AS n FROM reservations WHERE book_id = ? AND status IN ('pending','ready') AND user_id <> ?", [loan.book_id, loan.user_id], c))!.n;
    if (waiting) throw unprocessable('Another member has reserved this book, so it cannot be renewed');
    const base = loan.due_date > todayStr() ? loan.due_date : todayStr();
    const newDue = addDays(base, policy.renewalDays);
    await exec('UPDATE loans SET due_date = ?, renewal_count = renewal_count + 1 WHERE id = ?', [newDue, id], c);
    await exec('INSERT INTO loan_renewals (loan_id, renewed_by, old_due_date, new_due_date) VALUES (?,?,?,?)', [id, req.user!.id, loan.due_date, newDue], c);
    await notify(loan.user_id, 'loan_renewed', 'Loan renewed', `New due date: ${newDue}.`, '/member/loans', c);
    return { newDue, old: loan.due_date };
  });
  await audit(req, req.user!.id, 'loan.renew', 'loan', id, result);
  ok(res, shapeLoan(await queryOne(`${LOAN_SQL} WHERE l.id = ?`, [id])));
}));
