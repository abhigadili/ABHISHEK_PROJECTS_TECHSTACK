const { body, query } = require('express-validator');
const { idParam, dateField } = require('./common');

const month = [query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(), query('month').optional().isInt({ min: 1, max: 12 }).toInt(),
  query('departmentId').optional().isInt({ min: 1 }).toInt(), query('employeeId').optional().isInt({ min: 1 }).toInt()];
module.exports = {
  id: [idParam()],
  list: [dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true }), query('location').optional().isString().isLength({ max: 100 })],
  create: [dateField(body, 'holidayDate'), body('name').isString().trim().isLength({ min: 1, max: 120 }), body('location').optional().isString().trim().isLength({ min: 1, max: 100 }), body('isOptional').optional().isBoolean().toBoolean()],
  update: [idParam(), dateField(body, 'holidayDate', { optional: true }), body('name').optional().isString().trim().isLength({ min: 1, max: 120 }), body('location').optional().isString().trim().isLength({ min: 1, max: 100 }), body('isOptional').optional().isBoolean().toBoolean()],
  weeklyOffs: [body('location').optional().isString().trim().isLength({ min: 1, max: 100 }), body('days').isArray({ max: 7 }), body('days.*').isInt({ min: 0, max: 6 }).toInt()],
  month,
};
