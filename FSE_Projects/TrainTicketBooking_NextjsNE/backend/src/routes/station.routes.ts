import { Router } from 'express';
import { stationController as c } from '../controllers';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { stationQuery, stationSchema } from '../validations/catalog';
const r = Router();
r.get('/', validate('query', stationQuery), c.list); // public: station pickers on the search page
r.get('/:id', c.get);
r.post('/', authenticate, authorize('station:manage'), validate('body', stationSchema), c.create);
r.put('/:id', authenticate, authorize('station:manage'), validate('body', stationSchema), c.update);
r.delete('/:id', authenticate, authorize('station:manage'), c.remove);
export default r;
