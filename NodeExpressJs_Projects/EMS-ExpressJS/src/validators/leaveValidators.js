const { body, query } = require('express-validator');
const { idParam, dateField, pageQuery } = require('./common');
const C = require('../constants');

// `when` must come first in each chain so the conditional gates every validator that follows.
const policy = (pre, when) => [
  body(`${pre}.annualEntitlement`).if(when).isFloat({ min: 0, max: 366 }).toFloat(),
  body(`${pre}.carryForwardMax`).if(when).optional().isFloat({ min: 0, max: 366 }).toFloat(),
  body(`${pre}.allowHalfDay`).if(when).optional().isBoolean().toBoolean(),
  body(`${pre}.maxConsecutiveDays`).if(when).optional({ values: 'null' }).isInt({ min: 1, max: 366 }).toInt(),
];
const common = [...pageQuery, dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true }),
  query('status').optional().isIn(C.LEAVE_STATUS), query('employeeId').optional().isInt({ min: 1 }).toInt(),
  query('leaveTypeId').optional().isInt({ min: 1 }).toInt(), query('departmentId').optional().isInt({ min: 1 }).toInt(), query('format').optional().isIn(['json', 'csv'])];

module.exports = {
  id: [idParam()],
  apply: [
    body('leaveTypeId').isInt({ min: 1 }).toInt(), dateField(body, 'startDate'), dateField(body, 'endDate'),
    body('dayPart').optional().isIn(C.DAY_PARTS), body('reason').isString().trim().isLength({ min: 3, max: 1000 }).withMessage('reason must be 3-1000 characters'),
  ],
  decide: [idParam(), body('note').optional().isString().isLength({ max: 500 })],
  list: common,
  team: [dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true })],
  balances: [query('year').optional().isInt({ min: 2000, max: 2100 }).toInt()],
  employeeBalances: [idParam(), query('year').optional().isInt({ min: 2000, max: 2100 }).toInt()],
  adjust: [body('employeeId').isInt({ min: 1 }).toInt(), body('leaveTypeId').isInt({ min: 1 }).toInt(), body('year').isInt({ min: 2000, max: 2100 }).toInt(),
    body('amount').isFloat({ min: -366, max: 366 }).custom((v) => Number(v) !== 0).withMessage('amount must be non-zero').toFloat(),
    body('note').isString().trim().isLength({ min: 3, max: 300 }).withMessage('note is required')],
  typeCreate: [body('code').matches(/^[A-Z0-9_]{1,20}$/), body('name').isString().trim().isLength({ min: 1, max: 80 }), body('description').optional().isString().isLength({ max: 300 }),
    body('isPaid').optional().isBoolean().toBoolean(), body('requiresDocument').optional().isBoolean().toBoolean(), body('policy').optional().isObject(), ...policy('policy', body('policy').exists())],
  typeUpdate: [idParam(), body('name').optional().isString().trim().isLength({ min: 1, max: 80 }), body('isPaid').optional().isBoolean().toBoolean(),
    body('requiresDocument').optional().isBoolean().toBoolean(), body('isActive').optional().isBoolean().toBoolean(),
    body('policy').optional({ values: 'null' }).isObject(), ...policy('policy', body('policy').isObject())],
  doc: [idParam(), idParam('docId')],
  report: [...common],
};
