import type { PoolConnection } from 'mysql2/promise';
import { exec, query } from './db';
import { notify } from './notify';
import { getSettings } from './settings';

/**
 * Sets available copies aside for the oldest pending reservations of a book (FIFO queue).
 * Must run inside a transaction: rows are locked so concurrent returns/cancellations
 * can never hand one copy to two members.
 */
export async function allocateForBook(c: PoolConnection, bookId: number): Promise<number> {
  const { reservation_hold_days } = await getSettings(c);
  let allocated = 0;
  for (;;) {
    const [pend] = await query<any>(
      `SELECT r.id, r.user_id FROM reservations r
        WHERE r.book_id = ? AND r.status = 'pending' ORDER BY r.created_at, r.id LIMIT 1 FOR UPDATE`, [bookId], c);
    if (!pend) break;
    const [copy] = await query<any>(
      `SELECT id, accession_number FROM book_copies WHERE book_id = ? AND status = 'available'
        ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`, [bookId], c);
    if (!copy) break;
    await exec("UPDATE book_copies SET status = 'held' WHERE id = ?", [copy.id], c);
    await exec(
      `UPDATE reservations SET status = 'ready', copy_id = ?, ready_at = UTC_TIMESTAMP(),
              expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY) WHERE id = ?`, [copy.id, reservation_hold_days, pend.id], c);
    const [b] = await query<any>('SELECT title FROM books WHERE id = ?', [bookId], c);
    await notify(pend.user_id, 'reservation_ready', 'Your reserved book is ready',
      `"${b?.title}" is being held for you for ${reservation_hold_days} day(s). Please collect it at the desk.`,
      '/member/reservations', c);
    allocated++;
  }
  return allocated;
}

/** Close a ready reservation without fulfilment (expiry / staff cancel): releases its copy and passes it on. */
export async function releaseReservation(
  c: PoolConnection, reservationId: number, status: 'expired' | 'cancelled',
): Promise<void> {
  const [r] = await query<any>('SELECT id, book_id, copy_id, status FROM reservations WHERE id = ? FOR UPDATE', [reservationId], c);
  if (!r || !['pending', 'ready'].includes(r.status)) return;
  await exec('UPDATE reservations SET status = ?, closed_at = UTC_TIMESTAMP() WHERE id = ?', [status, reservationId], c);
  if (r.status === 'ready' && r.copy_id) {
    await exec("UPDATE book_copies SET status = 'available' WHERE id = ? AND status = 'held'", [r.copy_id], c);
    await allocateForBook(c, r.book_id);
  }
}
