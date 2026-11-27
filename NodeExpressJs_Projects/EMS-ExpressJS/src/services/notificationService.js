const repo = require('../repositories/notificationRepository');
const userRepo = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/** Create a notification for each user id. Best-effort: failures are logged, never thrown. */
async function notifyUsers(userIds, { type, title, message, refType, refId }, conn) {
  const ids = [...new Set(userIds.filter(Boolean))];
  try {
    for (const userId of ids) await repo.insert({ userId, type, title, message, refType, refId }, conn);
  } catch (e) {
    logger.error('notification.failed', { type, error: e.message });
  }
}
const notifyEmployees = async (employeeIds, payload, conn) =>
  notifyUsers(await userRepo.userIdsByEmployeeIds(employeeIds.filter(Boolean), conn), payload, conn);
const notifyRoles = async (roles, payload, conn) => notifyUsers(await userRepo.userIdsByRoles(roles, conn), payload, conn);

async function list(user, { unreadOnly, limit, offset }) {
  return repo.listForUser(user.id, { unreadOnly, limit, offset });
}
async function get(user, id) {
  const n = await repo.findById(id);
  if (!n || n.userId !== user.id) throw ApiError.notFound('Notification not found'); // no existence leak across users
  return n;
}
async function markRead(user, id) {
  await get(user, id);
  await repo.markRead(user.id, [id]);
  return get(user, id);
}
const markAllRead = (user, ids) => repo.markRead(user.id, ids && ids.length ? ids : null);
const unreadCount = (user) => repo.unreadCount(user.id);

module.exports = { notifyUsers, notifyEmployees, notifyRoles, list, get, markRead, markAllRead, unreadCount };
