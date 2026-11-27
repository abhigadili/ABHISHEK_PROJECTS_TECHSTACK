import { Router, RequestHandler } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { ROLES } from '../constants';

const router = Router();
router.use(authenticate as RequestHandler);

router.get('/',      authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.HR, ROLES.MANAGER]) as RequestHandler, employeeController.getAll as RequestHandler);
router.get('/:id',   authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.HR, ROLES.MANAGER]) as RequestHandler, employeeController.getById as RequestHandler);
router.post('/',     authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.HR]) as RequestHandler,                 employeeController.create as RequestHandler);
router.put('/:id',   authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.HR]) as RequestHandler,                 employeeController.update as RequestHandler);
router.delete('/:id',authorize([ROLES.SUPER_ADMIN]) as RequestHandler,                                        employeeController.delete as RequestHandler);

export default router;
