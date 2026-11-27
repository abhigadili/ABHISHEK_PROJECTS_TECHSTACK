import { Conn, exec } from './db';

/**
 * In-app notification stored in MySQL. `dedupeKey` makes scheduled reminders idempotent.
 * No email/SMS provider is bundled, so nothing is delivered outside the app.
 */
export async function notify(
  userId: number, type: string, title: string, message: string, link: string | null,
  conn?: Conn, dedupeKey: string | null = null,
) {
  await exec(
    'INSERT IGNORE INTO notifications (user_id, type, title, message, link, dedupe_key) VALUES (?,?,?,?,?,?)',
    [userId, type, title, message.slice(0, 500), link, dedupeKey], conn);
}
