import { Router, RequestHandler } from 'express';
import { postgresqlController } from '../controllers/postgresql.controller';
import { authenticate } from '../middlewares/authenticate.middleware';

const router = Router();
router.use(authenticate as RequestHandler);

router.get('/tables',               postgresqlController.showTables as RequestHandler);
router.get('/tables/:table/schema', postgresqlController.describeTable as RequestHandler);
router.post('/insert-one',          postgresqlController.insertOne as RequestHandler);
router.get('/select-where',         postgresqlController.selectWhere as RequestHandler);
router.get('/select-join',          postgresqlController.selectJoin as RequestHandler);
router.put('/update-one/:id',       postgresqlController.updateOne as RequestHandler);
router.delete('/delete-one/:id',    postgresqlController.deleteOne as RequestHandler);
router.get('/pagination',           postgresqlController.pagination as RequestHandler);
router.get('/sorting',              postgresqlController.sorting as RequestHandler);
router.get('/group-by',             postgresqlController.groupBy as RequestHandler);
router.get('/having',               postgresqlController.having as RequestHandler);
router.get('/subquery',             postgresqlController.subquery as RequestHandler);
router.get('/cte',                  postgresqlController.cte as RequestHandler);
router.get('/window-functions',     postgresqlController.windowFunctions as RequestHandler);
router.post('/transaction',         postgresqlController.transaction as RequestHandler);
router.get('/explain',              postgresqlController.explainQuery as RequestHandler);
router.get('/full-text-search',     postgresqlController.fullTextSearch as RequestHandler);

export default router;
