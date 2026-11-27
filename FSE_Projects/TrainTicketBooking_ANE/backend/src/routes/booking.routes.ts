import { Router } from 'express';
import { bookingController as c, passengerController as pc, paymentController as pay, refundController as rf, notificationController as nc, statsController as st } from '../controllers';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { bookingQuery, cancelBookingSchema, cancellationRulesSchema, confirmPaymentSchema, createBookingSchema, initiatePaymentSchema, passengerSchema } from '../validations/booking';
import { pageQuery } from '../validations/common';
import { z } from 'zod';

export const bookingRoutes = Router(); bookingRoutes.use(authenticate);
bookingRoutes.post('/', authorize('booking:create'), validate('body', createBookingSchema), c.create);
bookingRoutes.get('/', authorize('booking:read-own', 'booking:read-all'), validate('query', bookingQuery), c.list);
bookingRoutes.get('/pnr/:pnr', authorize('booking:read-own', 'booking:read-all'), c.byPnr);
bookingRoutes.get('/:id', authorize('booking:read-own', 'booking:read-all'), c.get);
bookingRoutes.get('/:id/cancellation-quote', authorize('booking:read-own', 'booking:read-all'), c.quote);
bookingRoutes.post('/:id/cancel', authorize('booking:read-own', 'booking:read-all'), validate('body', cancelBookingSchema), c.cancel);

export const passengerRoutes = Router(); passengerRoutes.use(authenticate);
passengerRoutes.get('/', validate('query', pageQuery.extend({ userId: z.coerce.number().int().optional() })), pc.list);
passengerRoutes.get('/:id', pc.get);
passengerRoutes.get('/:id/history', pc.history);
passengerRoutes.post('/', validate('body', passengerSchema), pc.create);
passengerRoutes.put('/:id', validate('body', passengerSchema), pc.update);
passengerRoutes.delete('/:id', pc.remove);

export const paymentRoutes = Router(); paymentRoutes.use(authenticate);
paymentRoutes.get('/', validate('query', pageQuery.extend({ status: z.string().optional() })), pay.list);
paymentRoutes.post('/', authorize('booking:create'), validate('body', initiatePaymentSchema), pay.initiate);
paymentRoutes.get('/:id', pay.get);
paymentRoutes.get('/:id/receipt', pay.receipt);
paymentRoutes.post('/:id/confirm', authorize('booking:create'), validate('body', confirmPaymentSchema), pay.confirm);

export const refundRoutes = Router(); refundRoutes.use(authenticate);
refundRoutes.get('/', validate('query', pageQuery), rf.list);
refundRoutes.get('/:id', rf.get);

export const cancellationRoutes = Router(); cancellationRoutes.use(authenticate);
cancellationRoutes.get('/', authorize('payment:read-all'), validate('query', pageQuery), c.cancellations);
cancellationRoutes.get('/rules', c.rules);
cancellationRoutes.put('/rules', authorize('settings:manage'), validate('body', cancellationRulesSchema), c.setRules);

export const notificationRoutes = Router(); notificationRoutes.use(authenticate, authorize('notification:read'));
notificationRoutes.get('/', validate('query', pageQuery.extend({ unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional() })), nc.list);
notificationRoutes.patch('/read-all', nc.readAll); // declared BEFORE /:id/read
notificationRoutes.get('/preferences', nc.prefs);
notificationRoutes.put('/preferences', validate('body', z.object({ inApp: z.boolean(), email: z.boolean() })), nc.setPrefs);
notificationRoutes.patch('/:id/read', nc.read);

export const adminRoutes = Router(); adminRoutes.use(authenticate, authorize('stats:read'));
adminRoutes.get('/stats', st.dashboard);
