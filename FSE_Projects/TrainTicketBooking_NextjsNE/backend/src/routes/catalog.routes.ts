import { Router } from 'express';
import { coachController as cc, routeController as rc, scheduleController as sc, trainController as tc } from '../controllers';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { availabilityQuery } from '../validations/booking';
import { routeSchema, scheduleSchema, seatStatusSchema } from '../validations/catalog';
import { pageQuery } from '../validations/common';
import { z } from 'zod';

export const routeRoutes = Router();
routeRoutes.get('/', validate('query', pageQuery), rc.list);
routeRoutes.get('/:id', rc.get);
routeRoutes.post('/', authenticate, authorize('train:manage'), validate('body', routeSchema.and(z.object({ trainId: z.coerce.number().int().positive() }))), rc.create);
routeRoutes.put('/:id', authenticate, authorize('train:manage'), validate('body', routeSchema), rc.update);

export const scheduleRoutes = Router();
scheduleRoutes.get('/', validate('query', pageQuery.extend({ trainId: z.coerce.number().int().optional() })), sc.list);
scheduleRoutes.get('/:id', sc.get);
scheduleRoutes.post('/', authenticate, authorize('schedule:manage'), validate('body', scheduleSchema), sc.create);
scheduleRoutes.put('/:id', authenticate, authorize('schedule:manage'), validate('body', scheduleSchema), sc.update);
scheduleRoutes.delete('/:id', authenticate, authorize('schedule:manage'), sc.remove);

export const coachRoutes = Router();
coachRoutes.get('/:id/seats', cc.seats);
coachRoutes.delete('/:id', authenticate, authorize('train:operate', 'train:manage'), cc.remove);

export const seatRoutes = Router();
seatRoutes.get('/availability', validate('query', availabilityQuery), cc.seatMap);
seatRoutes.patch('/:id', authenticate, authorize('train:operate', 'train:manage'), validate('body', seatStatusSchema), cc.seatStatus);

export const lookupRoutes = Router();
lookupRoutes.get('/coach-types', tc.coachTypes);
lookupRoutes.get('/seat-types', tc.seatTypes);
