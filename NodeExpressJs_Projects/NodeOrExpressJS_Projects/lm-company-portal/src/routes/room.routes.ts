import { Router, RequestHandler } from 'express';
import { roomController } from '../controllers/room.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { ROLES } from '../constants';

const router = Router();
router.use(authenticate as RequestHandler);

// Meeting room routes
router.get('/meeting-rooms/available',     roomController.getAvailable as RequestHandler);
router.post('/meeting-rooms/book',         roomController.bookRoom as RequestHandler);
router.delete('/meeting-rooms/cancel/:id', roomController.cancelBooking as RequestHandler);

// Room CRUD
router.get('/',       roomController.getAll as RequestHandler);
router.get('/:id',    roomController.getById as RequestHandler);
router.post('/',      authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]) as RequestHandler, roomController.create as RequestHandler);
router.put('/:id',    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]) as RequestHandler, roomController.update as RequestHandler);
router.delete('/:id', authorize([ROLES.SUPER_ADMIN]) as RequestHandler, roomController.delete as RequestHandler);

export default router;
