import { Router, RequestHandler } from 'express';
import { departmentController } from '../controllers/department.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { ROLES } from '../constants';

const router = Router();
router.use(authenticate as RequestHandler);

router.get('/',      departmentController.getAll as RequestHandler);
router.get('/:id',   departmentController.getById as RequestHandler);
router.post('/',     authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.HR]) as RequestHandler, departmentController.create as RequestHandler);
router.put('/:id',   authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]) as RequestHandler,           departmentController.update as RequestHandler);
router.delete('/:id',authorize([ROLES.SUPER_ADMIN]) as RequestHandler,                        departmentController.delete as RequestHandler);

export default router;
