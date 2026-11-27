import { Router } from 'express';
import { z } from 'zod';
import { exec, query, queryOne } from '../lib/db';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';
import { idParam, money, ok, parse, wrap } from '../lib/http';
import { adminOnly, requireAuth } from '../middleware/auth';

export const memberTypesRouter = Router();

const COLS = `id, name, description, max_loans AS maxLoans, loan_days AS loanDays, max_renewals AS maxRenewals,
  renewal_days AS renewalDays, max_reservations AS maxReservations, fine_per_day AS finePerDay, grace_days AS graceDays,
  max_fine_per_loan AS maxFinePerLoan, membership_days AS membershipDays, membership_fee AS membershipFee, is_active AS isActive`;

// Public: registration needs the list of types (active only unless staff asks for all).
memberTypesRouter.get('/', wrap(async (req, res) => {
  const rows = await query(`SELECT ${COLS} FROM member_types WHERE is_active = 1 ORDER BY id`);
  ok(res, rows.map((r: any) => ({ ...r, isActive: !!r.isActive })));
}));
memberTypesRouter.get('/all', requireAuth, adminOnly, wrap(async (_req, res) => {
  const rows = await query(`SELECT ${COLS}, (SELECT COUNT(*) FROM memberships m WHERE m.member_type_id = member_types.id AND m.status = 'active') AS activeMembers FROM member_types ORDER BY id`);
  ok(res, rows.map((r: any) => ({ ...r, isActive: !!r.isActive })));
}));

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(255).nullish(),
  maxLoans: z.coerce.number().int().min(0).max(100),
  loanDays: z.coerce.number().int().min(1).max(365),
  maxRenewals: z.coerce.number().int().min(0).max(20),
  renewalDays: z.coerce.number().int().min(1).max(365),
  maxReservations: z.coerce.number().int().min(0).max(100),
  finePerDay: money,
  graceDays: z.coerce.number().int().min(0).max(60),
  maxFinePerLoan: z.preprocess((v) => (v === '' || v === null ? null : v), money.nullable()),
  membershipDays: z.coerce.number().int().min(1).max(3650),
  membershipFee: money,
  isActive: z.boolean().default(true),
});
const toRow = (b: z.infer<typeof schema>) =>
  [b.name, b.description ?? null, b.maxLoans, b.loanDays, b.maxRenewals, b.renewalDays, b.maxReservations,
    b.finePerDay, b.graceDays, b.maxFinePerLoan, b.membershipDays, b.membershipFee, b.isActive ? 1 : 0];

memberTypesRouter.post('/', requireAuth, adminOnly, wrap(async (req, res) => {
  const b = parse(schema, req.body);
  const r = await exec(`INSERT INTO member_types (name, description, max_loans, loan_days, max_renewals, renewal_days, max_reservations,
    fine_per_day, grace_days, max_fine_per_loan, membership_days, membership_fee, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, toRow(b));
  await audit(req, req.user!.id, 'member_type.create', 'member_type', r.insertId, { name: b.name });
  ok(res, await queryOne(`SELECT ${COLS} FROM member_types WHERE id = ?`, [r.insertId]), 201);
}));

memberTypesRouter.put('/:id', requireAuth, adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(schema, req.body);
  const r = await exec(`UPDATE member_types SET name=?, description=?, max_loans=?, max_renewals=?, renewal_days=?, max_reservations=?,
    fine_per_day=?, grace_days=?, max_fine_per_loan=?, membership_days=?, membership_fee=?, is_active=?, loan_days=? WHERE id=?`,
    [b.name, b.description ?? null, b.maxLoans, b.maxRenewals, b.renewalDays, b.maxReservations, b.finePerDay, b.graceDays,
      b.maxFinePerLoan, b.membershipDays, b.membershipFee, b.isActive ? 1 : 0, b.loanDays, id]);
  if (!r.affectedRows) throw notFound('Membership type');
  await audit(req, req.user!.id, 'member_type.update', 'member_type', id, { name: b.name });
  ok(res, await queryOne(`SELECT ${COLS} FROM member_types WHERE id = ?`, [id]));
}));
