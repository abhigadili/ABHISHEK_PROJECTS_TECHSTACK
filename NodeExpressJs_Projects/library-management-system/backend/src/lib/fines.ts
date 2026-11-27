import { Conn, exec, queryOne } from './db';
import { diffDays, round2 } from './dates';
import { notify } from './notify';

export interface OverdueInput {
  dueDate: string; returnDate: string; finePerDay: number; graceDays: number; maxFinePerLoan: number | null;
}
export interface OverdueResult { daysOverdue: number; chargeableDays: number; amount: number }

/**
 * The single place overdue fines are computed.
 * daysOverdue    = whole days past the due date (0 if returned on or before it)
 * chargeableDays = daysOverdue minus the grace period
 * amount         = chargeableDays * rate, capped at the per-loan maximum
 */
export function calculateOverdueFine(i: OverdueInput): OverdueResult {
  const daysOverdue = Math.max(0, diffDays(i.dueDate, i.returnDate));
  const chargeableDays = Math.max(0, daysOverdue - i.graceDays);
  let amount = round2(chargeableDays * i.finePerDay);
  if (i.maxFinePerLoan !== null && i.maxFinePerLoan !== undefined) amount = Math.min(amount, i.maxFinePerLoan);
  return { daysOverdue, chargeableDays, amount };
}

export const fineOutstanding = (f: { amount: number; waived_amount: number; paid_amount: number }) =>
  round2(f.amount - f.waived_amount - f.paid_amount);

export function fineStatus(f: { amount: number; waived: number; paid: number }): 'outstanding' | 'partial' | 'paid' | 'waived' {
  const due = round2(f.amount - f.waived - f.paid);
  if (due > 0) return f.paid > 0 || f.waived > 0 ? 'partial' : 'outstanding';
  return f.paid > 0 ? 'paid' : 'waived';
}

export async function memberBalance(userId: number, conn?: Conn): Promise<number> {
  const r = await queryOne<{ b: number }>(
    'SELECT COALESCE(SUM(amount - waived_amount - paid_amount), 0) AS b FROM fines WHERE user_id = ?', [userId], conn);
  return round2(Number(r?.b ?? 0));
}

export async function createFine(
  conn: Conn, o: { userId: number; loanId: number | null; type: 'overdue' | 'lost' | 'damage' | 'manual'; amount: number; reason: string; createdBy: number | null },
): Promise<number | null> {
  if (o.amount <= 0) return null;
  const r = await exec(
    'INSERT INTO fines (user_id, loan_id, fine_type, amount, reason, created_by) VALUES (?,?,?,?,?,?)',
    [o.userId, o.loanId, o.type, round2(o.amount), o.reason, o.createdBy], conn);
  await notify(o.userId, 'fine_created', 'A fine was added to your account', `${o.reason} (amount ${o.amount.toFixed(2)}).`, '/member/fines', conn);
  return r.insertId;
}
