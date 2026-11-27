const router = require('express').Router();
const { query } = require('express-validator');
const c = require('../controllers/reportController');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { dateField } = require('../validators/common');
const { ADMINS, MANAGERS_UP } = require('../constants');

const fmt = query('format').optional().isIn(['json', 'csv']);
const range = [dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true }), fmt, query('departmentId').optional().isInt({ min: 1 }).toInt()];

router.get('/dashboard', authorize(MANAGERS_UP), c.dashboard);
router.get('/upcoming-events', authorize(MANAGERS_UP), query('days').optional().isInt({ min: 1, max: 365 }).toInt(), validate, c.upcoming);
router.get('/reports/joiners-exits', authorize(MANAGERS_UP), range, validate, c.joinersExits);
router.get('/reports/leave-balances', authorize(MANAGERS_UP), query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(), query('departmentId').optional().isInt({ min: 1 }).toInt(), fmt, validate, c.leaveBalances);
router.get('/reports/leave-summary', authorize(MANAGERS_UP), range, validate, c.leaveSummary);
router.get('/reports/departments', authorize(ADMINS), fmt, validate, c.departments);
router.get('/reports/designations', authorize(ADMINS), fmt, validate, c.designations);
module.exports = router;
