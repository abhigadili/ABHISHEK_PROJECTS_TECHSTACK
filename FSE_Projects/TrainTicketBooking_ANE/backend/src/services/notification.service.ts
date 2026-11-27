import { notificationRepo } from '../repositories/notification.repository';
import { sendMail } from './mail.service';
import { notFound } from '../utils/errors';
import { env } from '../config/env';
export interface NotifyInput { type: string; title: string; message: string; link?: string }
/** Creates in-app notification(s) and e-mails (per user preference). E-mail failure never breaks the business operation. */
export async function notify(userIds: number | number[], n: NotifyInput): Promise<void> {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  for (const u of await notificationRepo.users(ids)) {
    const pref = u.preferences ?? { inApp: true, email: true };
    const row = pref.inApp ? await notificationRepo.create({ userId: u.id, ...n }) : null;
    if (pref.email) void sendMail(u.email, n.title, `${n.message}\n${n.link ? env.FRONTEND_URL + n.link : ''}`).then(async (sent) => { if (sent && row) await notificationRepo.markEmailSent(row.id); }).catch((e) => console.error('[notify:mail]', e));
  }
}
export const notificationService = {
  async list(userId: number, q: { unread?: boolean; page: number; size: number }) { const [items, total, unread] = await notificationRepo.list(userId, !!q.unread, q.page * q.size, q.size); return { items, total, unread }; },
  async markRead(userId: number, id: number) { const r = await notificationRepo.markRead(userId, id); if (!r.count && !(await notificationRepo.exists(userId, id))) throw notFound('Notification'); },
  markAllRead: (userId: number) => notificationRepo.markAllRead(userId),
  async preferences(userId: number) { return (await notificationRepo.prefs(userId)) ?? { userId, inApp: true, email: true }; },
  setPreferences: (userId: number, d: { inApp: boolean; email: boolean }) => notificationRepo.setPrefs(userId, d),
};
