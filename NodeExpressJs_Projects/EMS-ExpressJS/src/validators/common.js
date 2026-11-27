const { body, param, query } = require('express-validator');
const pw = require('../utils/password');

const idParam = (name = 'id') => param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer`).toInt();
const dateField = (loc, name, { optional = false } = {}) => {
  const c = loc(name);
  return (optional ? c.optional({ values: 'null' }) : c.exists({ checkNull: true }).withMessage(`${name} is required`))
    .isISO8601({ strict: true, strictSeparator: true }).withMessage(`${name} must be a valid YYYY-MM-DD date`)
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${name} must be formatted as YYYY-MM-DD`);
};
const passwordField = (name = 'password') =>
  body(name).isString().custom((v) => pw.isStrong(v)).withMessage(pw.POLICY_MESSAGE);
const pageQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
const dateRangeQuery = [dateField(query, 'from', { optional: true }), dateField(query, 'to', { optional: true })];

module.exports = { idParam, dateField, passwordField, pageQuery, dateRangeQuery };
