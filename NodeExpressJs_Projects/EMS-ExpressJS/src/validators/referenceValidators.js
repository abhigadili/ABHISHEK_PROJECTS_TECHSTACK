const { body, query } = require('express-validator');
const { idParam, pageQuery } = require('./common');

const s = (n, max, req) => {
  const c = body(n);
  return (req ? c.exists().withMessage(`${n} is required`) : c.optional({ values: 'null' })).isString().trim().isLength({ min: req ? 1 : 0, max }).withMessage(`${n} must be at most ${max} chars`);
};
const fk = (n, req) => (req ? body(n).exists().withMessage(`${n} is required`) : body(n).optional({ values: 'null' })).isInt({ min: 1 }).toInt();
const listQ = [...pageQuery, query('q').optional().isString().isLength({ max: 100 }), query('isActive').optional().isBoolean().toBoolean()];

module.exports = {
  id: [idParam()],
  list: listQ,
  teamList: [...listQ, query('departmentId').optional().isInt({ min: 1 }).toInt()],
  deptCreate: [s('code', 20, true).matches(/^[A-Z0-9_-]+$/).withMessage('code must be A-Z, 0-9, _ or -'), s('name', 100, true), s('description', 500), fk('headEmployeeId')],
  deptUpdate: [idParam(), s('code', 20).matches(/^[A-Z0-9_-]+$/), s('name', 100), s('description', 500), fk('headEmployeeId')],
  teamCreate: [fk('departmentId', true), s('name', 100, true), s('description', 500), fk('leadEmployeeId')],
  teamUpdate: [idParam(), s('name', 100), s('description', 500), fk('leadEmployeeId'), body('isActive').optional().isBoolean().toBoolean()],
  teamMembers: [idParam(), body('employeeIds').isArray({ min: 1, max: 200 }), body('employeeIds.*').isInt({ min: 1 }).toInt()],
  desCreate: [s('name', 100, true), s('description', 500), body('jobLevel').optional().isInt({ min: 1, max: 20 }).toInt()],
  desUpdate: [idParam(), s('name', 100), s('description', 500), body('jobLevel').optional().isInt({ min: 1, max: 20 }).toInt(), body('isActive').optional().isBoolean().toBoolean()],
};
