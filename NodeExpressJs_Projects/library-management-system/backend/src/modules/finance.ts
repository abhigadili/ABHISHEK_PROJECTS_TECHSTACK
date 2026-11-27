import { Router } from 'express';
import { z } from 'zod';
import { exec, query, queryOne, withTx } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, forbidden, notFound, unprocessable } from '../lib/errors';
import { idParam, isoDate, money, ok, optStr, page, pagination, parse, wrap } from '../lib/http';
import { round2 } from '../lib/dates';
import { createFine, fineStatus, memberBalance } from '../lib/fines';
import { notify } from '../lib/notify';
import { getSettings } from '../lib/settings';
import { adminOnly, isStaff, requireAuth, staffOnly } from '../middleware/auth';
import { randomToken } from '../lib/password';

export const finesRouter = Router();
export const paymentsRouter = Router();
finesRouter.use(requireAuth);
paymentsRouter.use(requireAuth);

const FINE_SQL = `
  SELECT f.id, f.user_id AS userId, u.full_name AS memberName, mp.member_code AS memberCode, f.loan_id AS loanId, f.fine_type AS fineType,
         f.amount, f.waived_amount AS waivedAmount, f.paid_amount AS paidAmount,
         ROUND(f.amount - f.waived_amount - f.paid_amount, 2) AS outstanding, f.status, f.reason, f.waiver_reason AS waiverReason,
         f.created_at AS createdAt, cb.full_name AS createdBy, wb.full_name AS waivedBy, b.title AS bookTitle
    FROM fines f JOIN users u ON u.id = f.user_id JOIN member_profiles mp ON mp.user_id = f.user_id
    LEFT JOIN users cb ON cb.id = f.created_by LEFT JOIN users wb ON wb.id = f.waived_by
    LEFT JOIN loans l ON l.id = f.loan_id LEFT JOIN books b ON b.id = l.book_id`;

function fineFilters(q: Record<string, any>) {
  const where: string[] = []; const args: any[] = [];
  if (q.status === 'unpaid') where.push("f.status IN ('outstanding','partial')");
  else if (q.status) { where.push('f.status = ?'); args.push(String(q.status)); }
  if (q.type) { where.push('f.fine_type = ?'); args.push(String(q.type)); }
  if (q.memberId) { where.push('f.user_id = ?'); args.push(Number(q.memberId)); }
  if (q.q) { const l = `%${String(q.q).replace(/[%_]/g, '\\$&')}%`; where.push('(u.full_name LIKE ? OR mp.member_code LIKE ? OR f.reason LIKE ?)'); args.push(l, l, l); }
  if (q.from) { where.push('f.created_at >= ?'); args.push(`${q.from} 00:00:00`); }
  if (q.to) { where.push('f.created_at <= ?'); args.push(`${q.to} 23:59:59`); }
  return { where, args };
}

finesRouter.get('/', staffOnly, wrap(async (req, res) => {
  const p = pagination(req.query); const { where, args } = fineFilters(req.query);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${FINE_SQL} ${w}) x`, args))!.n;
  page(res, await query(`${FINE_SQL} ${w} ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
}));

finesRouter.get('/mine', wrap(async (req, res) => {
  const p = pagination(req.query); const { where, args } = fineFilters({ ...req.query, memberId: undefined });
  where.push('f.user_id = ?'); args.push(req.user!.id);
  const w = `WHERE ${where.join(' AND ')}`;
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${FINE_SQL} ${w}) x`, args))!.n;
  const rows = await query(`${FINE_SQL} ${w} ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]);
  const out = await memberBalance(req.user!.id);
  res.json({ data: rows, meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)), outstanding: out } });
}));

finesRouter.get('/balance/:memberId', staffOnly, wrap(async (req, res) => {
  const id = idParam(req, 'memberId');
  ok(res, { memberId: id, outstanding: await memberBalance(id), maxOutstandingBalance: (await getSettings()).max_outstanding_balance });
}));

// Manual fines (e.g. membership card replacement, damage assessed later).
finesRouter.post('/', staffOnly, wrap(async (req, res) => {
  const b = parse(z.object({
    memberId: z.coerce.number().int().positive(), amount: money.refine((n) => n > 0, 'Amount must be greater than zero'),
    type: z.enum(['manual', 'damage', 'lost']).default('manual'), reason: z.string().trim().min(3, 'Reason is required').max(255),
    loanId: z.coerce.number().int().positive().optional(),
  }), req.body);
  if (!(await queryOne('SELECT 1 FROM users WHERE id = ? AND role_id = 3', [b.memberId]))) throw notFound('Member');
  if (b.loanId && !(await queryOne('SELECT 1 FROM loans WHERE id = ? AND user_id = ?', [b.loanId, b.memberId]))) throw badRequest('Loan does not belong to this member');
  const id = await withTx((c) => createFine(c, { userId: b.memberId, loanId: b.loanId ?? null, type: b.type, amount: b.amount, reason: b.reason, createdBy: req.user!.id }));
  await audit(req, req.user!.id, 'fine.create', 'fine', id, { amount: b.amount, type: b.type, memberId: b.memberId });
  ok(res, await queryOne(`${FINE_SQL} WHERE f.id = ?`, [id]), 201);
}));

finesRouter.post('/:id/waive', staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ amount: money.optional(), reason: z.string().trim().min(3, 'A reason is required').max(255) }), req.body);
  await withTx(async (c) => {
    const f = await queryOne<any>('SELECT * FROM fines WHERE id = ? FOR UPDATE', [id], c);
    if (!f) throw notFound('Fine');
    const due = round2(f.amount - f.waived_amount - f.paid_amount);
    if (due <= 0) throw unprocessable('This fine has no outstanding balance');
    const amt = b.amount ?? due;
    if (amt <= 0 || amt > due) throw unprocessable(`Waiver must be between 0.01 and ${due.toFixed(2)}`);
    const waived = round2(f.waived_amount + amt);
    await exec('UPDATE fines SET waived_amount = ?, status = ?, waiver_reason = ?, waived_by = ? WHERE id = ?',
      [waived, fineStatus({ amount: f.amount, waived, paid: f.paid_amount }), b.reason, req.user!.id, id], c);
    await notify(f.user_id, 'fine_waived', 'A fine was waived', `${amt.toFixed(2)} was waived: ${b.reason}`, '/member/fines', c);
  });
  await audit(req, req.user!.id, 'fine.waive', 'fine', id, { amount: b.amount ?? 'full', reason: b.reason });
  ok(res, await queryOne(`${FINE_SQL} WHERE f.id = ?`, [id]));
}));

// ===== Payments ============================================================================
const PAY_SQL = `
  SELECT p.id, p.receipt_number AS receiptNumber, p.user_id AS userId, u.full_name AS memberName, mp.member_code AS memberCode,
         p.kind, p.amount, p.method, p.reference, p.notes, p.reverses_payment_id AS reversesPaymentId,
         EXISTS (SELECT 1 FROM payments r WHERE r.reverses_payment_id = p.id) AS isRefunded,
         rb.full_name AS receivedBy, p.created_at AS createdAt
    FROM payments p JOIN users u ON u.id = p.user_id JOIN member_profiles mp ON mp.user_id = p.user_id
    LEFT JOIN users rb ON rb.id = p.received_by`;

function payFilters(q: Record<string, any>) {
  const where: string[] = []; const args: any[] = [];
  if (q.method) { where.push('p.method = ?'); args.push(String(q.method)); }
  if (q.kind) { where.push('p.kind = ?'); args.push(String(q.kind)); }
  if (q.memberId) { where.push('p.user_id = ?'); args.push(Number(q.memberId)); }
  if (q.q) { const l = `%${String(q.q).replace(/[%_]/g, '\\$&')}%`; where.push('(u.full_name LIKE ? OR mp.member_code LIKE ? OR p.receipt_number LIKE ? OR p.reference LIKE ?)'); args.push(l, l, l, l); }
  if (q.from) { where.push('p.created_at >= ?'); args.push(`${q.from} 00:00:00`); }
  if (q.to) { where.push('p.created_at <= ?'); args.push(`${q.to} 23:59:59`); }
  return { where, args };
}
const shapePay = (r: any) => ({ ...r, isRefunded: !!r.isRefunded });

paymentsRouter.get('/', staffOnly, wrap(async (req, res) => {
  const p = pagination(req.query); const { where, args } = payFilters(req.query);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${PAY_SQL} ${w}) x`, args))!.n;
  page(res, (await query(`${PAY_SQL} ${w} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset])).map(shapePay), p, total);
}));
paymentsRouter.get('/mine', wrap(async (req, res) => {
  const p = pagination(req.query); const { where, args } = payFilters({ ...req.query, memberId: undefined });
  where.push('p.user_id = ?'); args.push(req.user!.id);
  const w = `WHERE ${where.join(' AND ')}`;
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${PAY_SQL} ${w}) x`, args))!.n;
  page(res, (await query(`${PAY_SQL} ${w} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset])).map(shapePay), p, total);
}));

// Printable receipt data.
paymentsRouter.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const pay = await queryOne<any>(`${PAY_SQL} WHERE p.id = ?`, [id]);
  if (!pay) throw notFound('Payment');
  if (!isStaff(req.user) && pay.userId !== req.user!.id) throw forbidden();
  const allocations = await query(`SELECT pa.id, pa.fine_id AS fineId, pa.amount, f.fine_type AS fineType, f.reason
    FROM payment_allocations pa JOIN fines f ON f.id = pa.fine_id WHERE pa.payment_id = ? ORDER BY pa.id`, [id]);
  const s = await getSettings();
  ok(res, { ...shapePay(pay), allocations, library: { name: s.library_name, address: s.library_address, phone: s.library_phone, email: s.library_email, currency: s.currency_symbol } });
}));

const paySchema = z.object({
  memberId: z.coerce.number().int().positive(),
  amount: money.refine((n) => n > 0, 'Amount must be greater than zero'),
  method: z.enum(['cash', 'card', 'online', 'cheque', 'other']).default('cash'),
  // Only a reference is stored (e.g. terminal slip or gateway id) - never card numbers.
  reference: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(100).regex(/^[A-Za-z0-9 ._\-/#]*$/, 'Reference may only contain letters, digits and . _ - / #').refine((v) => !/\d{13,19}/.test(v.replace(/[\s-]/g, '')), 'Do not enter card numbers').nullable().optional()),
  notes: optStr(255).refine((v) => !v || !/\d{13,19}/.test(v.replace(/[\s-]/g, '')), 'Do not enter card numbers'),
  fineIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
});

/**
 * Applies a payment to unpaid fines (oldest first, or the chosen fines) inside one transaction.
 * Fine rows are locked FOR UPDATE, so concurrent payments cannot over-apply or lose updates.
 */
paymentsRouter.post('/', staffOnly, wrap(async (req, res) => {
  const b = parse(paySchema, req.body);
  const result = await withTx(async (c) => {
    if (!(await queryOne('SELECT id FROM users WHERE id = ? AND role_id = 3 FOR UPDATE', [b.memberId], c))) throw notFound('Member');
    let sql = "SELECT * FROM fines WHERE user_id = ? AND status IN ('outstanding','partial')";
    const args: any[] = [b.memberId];
    if (b.fineIds?.length) { sql += ` AND id IN (${b.fineIds.map(() => '?').join(',')})`; args.push(...b.fineIds); }
    const [fines] = await c.query(`${sql} ORDER BY created_at, id FOR UPDATE`, args) as any[];
    if (b.fineIds?.length && fines.length !== new Set(b.fineIds).size) throw unprocessable('Some selected fines are not payable');
    const totalDue = round2(fines.reduce((a: number, f: any) => a + (f.amount - f.waived_amount - f.paid_amount), 0));
    if (totalDue <= 0) throw unprocessable('This member has no outstanding fines');
    if (b.amount > totalDue) throw unprocessable(`Payment exceeds the outstanding balance of ${totalDue.toFixed(2)}`);

    const ins = await exec('INSERT INTO payments (receipt_number, user_id, kind, amount, method, reference, notes, received_by) VALUES (?,?,?,?,?,?,?,?)',
      [`TMP-${randomToken(9)}`, b.memberId, 'payment', b.amount, b.method, b.reference ?? null, b.notes, req.user!.id], c);
    const receipt = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(ins.insertId).padStart(6, '0')}`;
    await exec('UPDATE payments SET receipt_number = ? WHERE id = ?', [receipt, ins.insertId], c);

    let left = b.amount;
    for (const f of fines) {
      if (left <= 0) break;
      const due = round2(f.amount - f.waived_amount - f.paid_amount);
      const apply = Math.min(due, left);
      left = round2(left - apply);
      const paid = round2(f.paid_amount + apply);
      await exec('UPDATE fines SET paid_amount = ?, status = ? WHERE id = ?', [paid, fineStatus({ amount: f.amount, waived: f.waived_amount, paid }), f.id], c);
      await exec('INSERT INTO payment_allocations (payment_id, fine_id, amount) VALUES (?,?,?)', [ins.insertId, f.id, apply], c);
    }
    const balance = await memberBalance(b.memberId, c);
    await notify(b.memberId, 'payment', 'Payment received', `We received ${b.amount.toFixed(2)} (receipt ${receipt}). Remaining balance: ${balance.toFixed(2)}.`, '/member/fines', c);
    return { id: ins.insertId, receipt, balance };
  });
  await audit(req, req.user!.id, 'payment.record', 'payment', result.id, { amount: b.amount, method: b.method, memberId: b.memberId });
  ok(res, { ...shapePay((await queryOne(`${PAY_SQL} WHERE p.id = ?`, [result.id]))!), remainingBalance: result.balance }, 201);
}));

// Reversal: a negative-effect record linked to the original; nothing is deleted.
paymentsRouter.post('/:id/refund', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ reason: z.string().trim().min(3, 'A reason is required').max(255) }), req.body);
  const refundId = await withTx(async (c) => {
    const p = await queryOne<any>('SELECT * FROM payments WHERE id = ? FOR UPDATE', [id], c);
    if (!p) throw notFound('Payment');
    if (p.kind !== 'payment') throw unprocessable('Only payments can be reversed');
    if (await queryOne('SELECT 1 FROM payments WHERE reverses_payment_id = ?', [id], c)) throw unprocessable('This payment was already reversed');
    const ins = await exec('INSERT INTO payments (receipt_number, user_id, kind, amount, method, reference, notes, reverses_payment_id, received_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [`TMP-${randomToken(9)}`, p.user_id, 'refund', p.amount, p.method, p.reference, b.reason, id, req.user!.id], c);
    await exec('UPDATE payments SET receipt_number = ? WHERE id = ?', [`REFUND-${String(ins.insertId).padStart(6, '0')}`, ins.insertId], c);
    const [allocs] = await c.query('SELECT fine_id, amount FROM payment_allocations WHERE payment_id = ?', [id]) as any[];
    for (const a of allocs) {
      const f = await queryOne<any>('SELECT * FROM fines WHERE id = ? FOR UPDATE', [a.fine_id], c);
      const paid = round2(f.paid_amount - a.amount);
      await exec('UPDATE fines SET paid_amount = ?, status = ? WHERE id = ?', [paid, fineStatus({ amount: f.amount, waived: f.waived_amount, paid }), f.id], c);
    }
    await notify(p.user_id, 'payment', 'Payment reversed', `Payment ${p.receipt_number} was reversed: ${b.reason}`, '/member/fines', c);
    return ins.insertId;
  });
  await audit(req, req.user!.id, 'payment.refund', 'payment', id, { refundId, reason: b.reason });
  ok(res, shapePay((await queryOne(`${PAY_SQL} WHERE p.id = ?`, [refundId]))!), 201);
}));
