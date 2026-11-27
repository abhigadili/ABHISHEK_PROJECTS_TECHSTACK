import { Router, RequestHandler } from 'express';
import { mongodbController } from '../controllers/mongodb.controller';
import { authenticate } from '../middlewares/authenticate.middleware';

const router = Router();
router.use(authenticate as RequestHandler);

router.get('/show-dbs',           mongodbController.showDbs as RequestHandler);
router.get('/show-collections',   mongodbController.showCollections as RequestHandler);
router.post('/insert-one',        mongodbController.insertOne as RequestHandler);
router.post('/insert-many',       mongodbController.insertMany as RequestHandler);
router.get('/find',               mongodbController.find as RequestHandler);
router.get('/find-one/:email',    mongodbController.findOne as RequestHandler);
router.put('/update-one/:id',     mongodbController.updateOne as RequestHandler);
router.put('/update-many',        mongodbController.updateMany as RequestHandler);
router.put('/replace-one/:id',    mongodbController.replaceOne as RequestHandler);
router.delete('/delete-one/:id',  mongodbController.deleteOne as RequestHandler);
router.delete('/delete-many',     mongodbController.deleteMany as RequestHandler);
router.patch('/find-one-update/:id',   mongodbController.findOneAndUpdate as RequestHandler);
router.delete('/find-one-delete/:id',  mongodbController.findOneAndDelete as RequestHandler);
router.get('/query-operators',    mongodbController.queryOperators as RequestHandler);
router.get('/logical-operators',  mongodbController.logicalOperators as RequestHandler);
router.get('/array-operators',    mongodbController.arrayOperators as RequestHandler);
router.get('/projection',         mongodbController.projection as RequestHandler);
router.get('/sorting',            mongodbController.sorting as RequestHandler);
router.get('/pagination',         mongodbController.pagination as RequestHandler);
router.get('/aggregation',        mongodbController.aggregation as RequestHandler);
router.get('/lookup',             mongodbController.lookup as RequestHandler);
router.get('/facet',              mongodbController.facet as RequestHandler);
router.get('/add-fields',         mongodbController.addFields as RequestHandler);
router.get('/bucket',             mongodbController.bucket as RequestHandler);
router.get('/count',              mongodbController.count as RequestHandler);

export default router;
