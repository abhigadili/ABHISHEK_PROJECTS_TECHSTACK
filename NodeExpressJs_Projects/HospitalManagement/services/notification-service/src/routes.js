import { ROLES } from '@hms/shared/constants';
import { idParams, searchQuery, pageQuery, sendBody } from './schemas.js';

const { ADMIN } = ROLES;

export function registerRoutes(api, svc, { prisma }) {
  api.get('/api/notifications', { summary: 'Search notifications', roles: [ADMIN], query: searchQuery }, async (req, res) => res.json(await svc.search(req.valid.query)));
  api.get('/api/notifications/my', { summary: "Notifications addressed to the caller's e-mail", query: pageQuery }, async (req, res) => res.json(await svc.mine(req.valid.query, req.user)));
  api.get('/api/notifications/:id', { summary: 'Notification details', roles: [ADMIN], params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id)));
  api.post('/api/notifications/send', { summary: 'Queue a manual notification', roles: [ADMIN], body: sendBody }, async (req, res) => {
    const n = await svc.queue(prisma, { email: req.valid.body.recipientEmail, phone: req.valid.body.recipientPhone, subject: req.valid.body.subject, message: req.valid.body.message, eventType: 'MANUAL' });
    res.status(201).json(await svc.get(n.id));
  });
}
