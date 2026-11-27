import { NotFoundError, pageOf } from '@hms/shared/utils';

const toDto = (n) => ({ id: n.id, recipientEmail: n.recipientEmail, channel: n.channel, subject: n.subject, message: n.message, eventType: n.eventType, referenceId: n.referenceId, status: n.status, createdAt: n.createdAt, sentAt: n.sentAt });
const trunc = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 3)}...`);

/** Notifications are queued as PENDING by the Kafka handlers and delivered by the cron-driven delivery worker (simulated e-mail/SMS: log line + stored record). */
export function createNotificationService({ prisma, logger }) {
  const queue = (db, { email, phone, channel = 'EMAIL', subject, message, eventType, referenceId }) =>
    db.notification.create({ data: { recipientEmail: email || 'unknown', recipientPhone: phone ?? null, channel, subject: trunc(subject, 200), message: trunc(message, 2000), eventType, referenceId: referenceId ?? null } });

  async function search({ eventType, email, page, size }) {
    const where = { ...(eventType ? { eventType } : {}), ...(email ? { recipientEmail: email.trim().toLowerCase() } : {}) };
    const [rows, total] = await Promise.all([prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page * size, take: size }), prisma.notification.count({ where })]);
    return pageOf(rows.map(toDto), page, size, total);
  }
  async function mine({ page, size }, user) {
    if (!user.email) return pageOf([], page, size, 0);
    return search({ email: user.email, page, size });
  }
  const get = async (id) => toDto((await prisma.notification.findUnique({ where: { id } })) ?? (() => { throw new NotFoundError(`Notification ${id} not found`); })());

  /** Delivery worker (node-cron): PENDING -> SENT, retried up to 3 attempts, then FAILED. Replace deliver() to plug in a real e-mail/SMS provider. */
  const deliver = (n) => {
    if (!n.recipientEmail || n.recipientEmail === 'unknown') throw new Error('No recipient address');
    logger.info({ channel: n.channel, recipient: n.recipientEmail, subject: n.subject, eventType: n.eventType, ref: n.referenceId }, `[${n.channel}] ${n.subject} | ${n.message}`);
  };
  async function deliverPending() {
    const batch = await prisma.notification.findMany({ where: { status: 'PENDING' }, orderBy: { id: 'asc' }, take: 50 });
    for (const n of batch) {
      const attempts = n.attempts + 1;
      try { deliver(n); await prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', sentAt: new Date(), attempts } }); } catch (e) {
        logger.warn({ id: n.id, attempt: attempts, err: e.message }, 'Notification delivery failed');
        await prisma.notification.update({ where: { id: n.id }, data: { attempts, failureReason: e.message.slice(0, 255), ...(attempts >= 3 ? { status: 'FAILED' } : {}) } });
      }
    }
  }
  return { queue, search, mine, get, deliverPending };
}
