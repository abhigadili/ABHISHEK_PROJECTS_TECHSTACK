const router = require('express').Router();
const { query } = require('express-validator');
const c = require('../controllers/orgController');
const validate = require('../middleware/validate');
const { idParam } = require('../validators/common');

const depth = query('depth').optional().isInt({ min: 1, max: 25 }).toInt();
router.get('/', depth, query('departmentId').optional().isInt({ min: 1 }).toInt(), validate, c.full);
router.get('/search', query('q').isString().trim().isLength({ min: 1, max: 100 }), query('rootId').optional().isInt({ min: 1 }).toInt(), validate, c.search);
router.get('/employees/:id', idParam(), depth, validate, c.subtree);
router.get('/employees/:id/direct-reports', idParam(), validate, c.reports);
router.get('/employees/:id/reporting-chain', idParam(), validate, c.chain);
module.exports = router;
