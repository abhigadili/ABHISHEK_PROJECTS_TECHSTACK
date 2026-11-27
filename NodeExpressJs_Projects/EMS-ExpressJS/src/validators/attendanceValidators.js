const { body, query } = require('express-validator');
const { idParam, dateField, pageQuery } = require('./common');
const C = require('../constants');

const ts = (n, opt = true) => (opt ? body(n).optional({ values: 'null' }) : body(n)).isISO8601().withMessage(`${n} must be an ISO-8601 timestamp`);
module.exports = {
  checkIn: [body('workMode').optional().isIn(C.WORK_MODES), body('remarks').optional().isString().isLength({ max: 500 })],
  checkOut: [body('remarks').optional().isString().isLength({ max: 500 })],
  id: [idParam()],
  list: [...pageQuery, dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true }),
    query('employeeId').optional().isInt({ min: 1 }).toInt(), query('departmentId').optional().isInt({ min: 1 }).toInt(),
    query('status').optional().isIn(C.ATTENDANCE_STATUS), query('format').optional().isIn(['json', 'csv'])],
  summary: [dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true }), query('employeeId').optional().isInt({ min: 1 }).toInt()],
  monthly: [query('year').isInt({ min: 2000, max: 2100 }).toInt(), query('month').isInt({ min: 1, max: 12 }).toInt(),
    query('departmentId').optional().isInt({ min: 1 }).toInt(), query('format').optional().isIn(['json', 'csv'])],
  department: [dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true }), query('format').optional().isIn(['json', 'csv'])],
  correct: [idParam(), ts('checkInAt'), ts('checkOutAt'), body('status').optional().isIn(C.ATTENDANCE_STATUS), body('workMode').optional().isIn(C.WORK_MODES),
    body('remarks').optional({ values: 'null' }).isString().isLength({ max: 500 }), body('reason').isString().trim().isLength({ min: 3, max: 500 }).withMessage('reason is required (3-500 chars)')],
  manual: [body('employeeId').isInt({ min: 1 }).toInt(), dateField(body, 'workDate'), ts('checkInAt'), ts('checkOutAt'),
    body('status').optional().isIn(C.ATTENDANCE_STATUS), body('workMode').optional().isIn(C.WORK_MODES),
    body('remarks').optional({ values: 'null' }).isString().isLength({ max: 500 }), body('reason').isString().trim().isLength({ min: 3, max: 500 })],
};
