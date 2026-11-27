import { Router } from 'express';
import { userController as c } from '../controllers';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { userQuery, userRolesSchema, userStatusSchema, userUpdateSchema } from '../validations/user';
const r = Router(); r.use(authenticate);
r.get('/', authorize('user:read'), validate('query', userQuery), c.list);
r.get('/:id', c.get); // self, or user:read (resource-level check in the service)
r.put('/:id', validate('body', userUpdateSchema), c.update); // self, or user:manage
r.patch('/:id/status', authorize('user:manage'), validate('body', userStatusSchema), c.status);
r.put('/:id/roles', authorize('user:manage'), validate('body', userRolesSchema), c.roles);
r.delete('/:id', authorize('user:manage'), c.remove);
export default r;
