import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z } from '@hr/common';
import { NotificationController } from '../controllers/notification.controller';
import { emailSettingsDto, historyQuery, listQuery, manualDto, previewDto, templateDto } from '../dto/notification.dto';
import { NotificationService } from '../services/notification.service';

export function notificationRoutes(r: Router, db: Db): void {
  const c = new NotificationController(new NotificationService(db));
  const manage = requirePermission('NOTIFICATION_MANAGE');
  r.get('/notifications', validate({ query: listQuery }), h(c.mine));
  r.get('/notifications/unread-count', h(c.unread));
  r.post('/notifications/read-all', h(c.readAll));
  r.get('/notifications/delivery-log', manage, validate({ query: listQuery }), h(c.delivery));
  r.get('/notifications/templates', manage, h(c.templates));
  r.put('/notifications/templates', manage, validate({ body: templateDto }), h(c.upsertTemplate));
  r.post('/notifications/templates/:code/preview', manage, validate({ params: z.object({ code: z.string().min(2).max(60) }), body: previewDto }), h(c.preview));
  r.get('/notifications/email-settings', manage, h(c.settings));
  r.put('/notifications/email-settings', manage, validate({ body: emailSettingsDto }), h(c.updateSettings));
  r.post('/notifications/send', manage, validate({ body: manualDto }), h(c.manual));
  r.get('/notifications/events/history', requirePermission('NOTIFICATION_MANAGE', 'AUDIT_VIEW'), validate({ query: historyQuery }), h(c.history));
  r.get('/notifications/events/topics', requirePermission('NOTIFICATION_MANAGE', 'AUDIT_VIEW'), h(c.topics));
  r.get('/notifications/events/history/:id', requirePermission('NOTIFICATION_MANAGE', 'AUDIT_VIEW'), validate({ params: idParam }), h(c.eventDetail));
  r.post('/notifications/:id/read', validate({ params: idParam }), h(c.read));
  r.post('/notifications/:id/unread', validate({ params: idParam }), h(c.unreadMark));
}
