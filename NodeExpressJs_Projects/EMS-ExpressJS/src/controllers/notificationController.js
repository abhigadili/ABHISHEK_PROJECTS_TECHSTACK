const svc = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

module.exports = {
  list: asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const { items, total } = await svc.list(req.user, { unreadOnly: req.query.unread === true, limit: p.limit, offset: p.offset });
    paged(res, { items, page: p.page, limit: p.limit, total }, 'Notifications retrieved successfully');
  }),
  unreadCount: asyncHandler(async (req, res) => ok(res, { unread: await svc.unreadCount(req.user) }, 'Unread count retrieved')),
  get: asyncHandler(async (req, res) => ok(res, await svc.get(req.user, req.params.id), 'Notification retrieved successfully')),
  markRead: asyncHandler(async (req, res) => ok(res, await svc.markRead(req.user, req.params.id), 'Notification marked as read')),
  markAllRead: asyncHandler(async (req, res) => ok(res, { updated: await svc.markAllRead(req.user, req.body.ids) }, 'Notifications marked as read')),
};
