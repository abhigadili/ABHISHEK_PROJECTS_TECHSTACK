import { Router, RequestHandler } from 'express';
import { companyController } from '../controllers/company.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validate } from '../middlewares/validate.middleware';
import { cacheMiddleware } from '../middlewares/cache.middleware';
import { createCompanySchema, updateCompanySchema } from '../validators/company.validator';
import { ROLES } from '../constants';

const router = Router();
router.use(authenticate as RequestHandler);

router.get('/',     cacheMiddleware('companies') as RequestHandler,            companyController.getAll as RequestHandler);
router.get('/:id',  cacheMiddleware('company') as RequestHandler,              companyController.getById as RequestHandler);
router.post('/',    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]) as RequestHandler, validate(createCompanySchema) as RequestHandler, companyController.create as RequestHandler);
router.put('/:id',  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]) as RequestHandler, validate(createCompanySchema) as RequestHandler, companyController.update as RequestHandler);
router.patch('/:id',authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]) as RequestHandler, validate(updateCompanySchema) as RequestHandler, companyController.patch as RequestHandler);
router.delete('/:id',authorize([ROLES.SUPER_ADMIN]) as RequestHandler,             companyController.delete as RequestHandler);

export default router;
