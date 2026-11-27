import { exec, query, withTx } from '../lib/db';
import { notify } from '../lib/notify';
import { releaseReservation } from '../lib/reservations';
import { getSettings } from '../lib/settings';

/**
 * Housekeeping that depends on the passage of time. Idempotent: reminders carry a dedupe key,
 * and every state change is conditional, so running it twice (or from two processes) is safe.
 */
export async function runMaintenance() {
  const out = { reservationsExpired: 0, dueSoonReminders: 0, overdueNotices: 0, membershipsExpired: 0, membershipExpiryReminders: 0, sessionsPurged: 0 };
  const s = await getSettings();

  // 1. Ready reservations whose hold period ended -> expire and pass the copy on.
  const stale = await query<any>("SELECT id, user_id, book_id FROM reservations WHERE status = 'ready' AND expires_at < UTC_TIMESTAMP()");
  for (const r of stale) {
    await withTx(async (c) => {
      await releaseReservation(c, r.id, 'expired');
      const [b] = await query<any>('SELECT title FROM books WHERE id = ?', [r.book_id], c);
      await notify(r.user_id, 'reservation_expired', 'Reservation expired', `Your hold on "${b?.title}" expired because it was not collected in time.`, '/member/reservations', c);
    });
    out.reservationsExpired++;
  }

  // 2. Upcoming due dates.
  const soon = await query<any>(
    `SELECT l.id, l.user_id, l.due_date, b.title FROM loans l JOIN books b ON b.id = l.book_id
      WHERE l.status = 'active' AND l.due_date >= UTC_DATE() AND l.due_date <= DATE_ADD(UTC_DATE(), INTERVAL ? DAY)`, [s.due_soon_days]);
  for (const l of soon) {
    const r = await exec('INSERT IGNORE INTO notifications (user_id, type, title, message, link, dedupe_key) VALUES (?,?,?,?,?,?)',
      [l.user_id, 'due_soon', 'Book due soon', `"${l.title}" is due on ${l.due_date}.`, '/member/loans', `due-soon:${l.id}:${l.due_date}`]);
    out.dueSoonReminders += r.affectedRows;
  }

  // 3. Overdue (one notice per loan per day).
  const late = await query<any>(
    `SELECT l.id, l.user_id, l.due_date, b.title, DATEDIFF(UTC_DATE(), l.due_date) AS days FROM loans l JOIN books b ON b.id = l.book_id
      WHERE l.status = 'active' AND l.due_date < UTC_DATE()`);
  for (const l of late) {
    const r = await exec('INSERT IGNORE INTO notifications (user_id, type, title, message, link, dedupe_key) VALUES (?,?,?,?,?,?)',
      [l.user_id, 'overdue', 'Book overdue', `"${l.title}" is ${l.days} day(s) overdue. Fines may apply.`, '/member/loans', `overdue:${l.id}:${new Date().toISOString().slice(0, 10)}`]);
    out.overdueNotices += r.affectedRows;
  }

  // 4. Membership expiry.
  const expired = await query<any>("SELECT id, user_id, end_date FROM memberships WHERE status = 'active' AND end_date < UTC_DATE()");
  for (const m of expired) {
    const r = await exec("UPDATE memberships SET status = 'expired' WHERE id = ? AND status = 'active'", [m.id]);
    if (r.affectedRows) {
      await notify(m.user_id, 'membership_expired', 'Membership expired', `Your membership expired on ${m.end_date}. Visit the library to renew.`, '/member/membership', undefined, `mem-expired:${m.id}`);
      out.membershipsExpired++;
    }
  }
  const ending = await query<any>("SELECT id, user_id, end_date FROM memberships WHERE status = 'active' AND end_date >= UTC_DATE() AND end_date <= DATE_ADD(UTC_DATE(), INTERVAL 7 DAY)");
  for (const m of ending) {
    const r = await exec('INSERT IGNORE INTO notifications (user_id, type, title, message, link, dedupe_key) VALUES (?,?,?,?,?,?)',
      [m.user_id, 'membership_expiring', 'Membership expiring soon', `Your membership ends on ${m.end_date}.`, '/member/membership', `mem-soon:${m.id}`]);
    out.membershipExpiryReminders += r.affectedRows;
  }

  // 5. Housekeeping.
  out.sessionsPurged = (await exec('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()')).affectedRows;
  await exec("DELETE FROM password_reset_tokens WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)");
  return out;
}

export function startScheduler(everyMs = 60 * 60 * 1000) {
  const run = () => runMaintenance().then((r) => console.log('[maintenance]', JSON.stringify(r))).catch((e) => console.error('[maintenance] failed', e?.message ?? e));
  setTimeout(run, 5_000).unref();
  return setInterval(run, everyMs).unref();
}
