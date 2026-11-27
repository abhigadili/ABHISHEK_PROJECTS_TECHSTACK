import { Conn, query, queryOne } from './db';
import { addDays, todayStr } from './dates';

export interface MemberPolicy {
  membershipId: number; memberTypeId: number; typeName: string;
  startDate: string; endDate: string; membershipStatus: string; expired: boolean;
  maxLoans: number; loanDays: number; maxRenewals: number; renewalDays: number; maxReservations: number;
  finePerDay: number; graceDays: number; maxFinePerLoan: number | null;
}

/** Current membership term (latest end date among non-cancelled terms) joined with its policy. */
export async function getMemberPolicy(userId: number, conn?: Conn): Promise<MemberPolicy | null> {
  const r = await queryOne<any>(
    `SELECT m.id AS membershipId, m.member_type_id AS memberTypeId, t.name AS typeName,
            m.start_date AS startDate, m.end_date AS endDate, m.status AS membershipStatus,
            t.max_loans AS maxLoans, t.loan_days AS loanDays, t.max_renewals AS maxRenewals,
            t.renewal_days AS renewalDays, t.max_reservations AS maxReservations,
            t.fine_per_day AS finePerDay, t.grace_days AS graceDays, t.max_fine_per_loan AS maxFinePerLoan
       FROM memberships m JOIN member_types t ON t.id = m.member_type_id
      WHERE m.user_id = ? AND m.status <> 'cancelled'
      ORDER BY m.end_date DESC, m.id DESC LIMIT 1`, [userId], conn);
  if (!r) return null;
  return { ...r, expired: r.membershipStatus === 'expired' || r.endDate < todayStr() };
}

export async function startMembership(
  conn: Conn, userId: number, memberTypeId: number, createdBy: number | null, notes: string | null = null,
  startFrom?: string,
) {
  const t = await queryOne<{ membership_days: number }>('SELECT membership_days FROM member_types WHERE id = ?', [memberTypeId], conn);
  const start = startFrom ?? todayStr();
  const end = addDays(start, t?.membership_days ?? 365);
  await query(
    `INSERT INTO memberships (user_id, member_type_id, start_date, end_date, status, created_by, notes)
     VALUES (?,?,?,?, 'active', ?, ?)`, [userId, memberTypeId, start, end, createdBy, notes], conn);
  return { start, end };
}
