const { body, query } = require('express-validator');
const { idParam, dateField, passwordField, pageQuery } = require('./common');
const C = require('../constants');
const pw = require('../utils/password');

const str = (n, max, req = false) => {
  const c = body(n);
  return (req ? c.exists({ checkNull: true }).withMessage(`${n} is required`) : c.optional({ values: 'null' }))
    .isString().withMessage(`${n} must be a string`).trim().isLength({ min: req ? 1 : 0, max }).withMessage(`${n} must be at most ${max} characters`);
};
const fk = (n) => body(n).optional({ values: 'null' }).isInt({ min: 1 }).withMessage(`${n} must be a positive integer`).toInt();

const fields = (isCreate) => [
  str('firstName', 60, isCreate), str('middleName', 60), str('lastName', 60, isCreate),
  body('workEmail').if((v, { req }) => isCreate || req.body.workEmail !== undefined).isEmail().withMessage('workEmail must be a valid email').isLength({ max: 190 }),
  body('personalEmail').optional({ values: 'null' }).isEmail().withMessage('personalEmail must be a valid email'),
  body('phone').optional({ values: 'null' }).matches(/^[+\d][\d\s().-]{5,28}$/).withMessage('phone is not a valid phone number'),
  dateField(body, 'dateOfBirth', { optional: true }).custom((v) => new Date(v) < new Date()).withMessage('dateOfBirth must be in the past'),
  dateField(body, 'joiningDate', { optional: !isCreate }),
  dateField(body, 'probationEndDate', { optional: true }),
  str('addressLine', 255), str('city', 100), str('state', 100), str('country', 100), str('postalCode', 20),
  str('emergencyContactName', 120), str('emergencyContactPhone', 30), str('emergencyContactRelation', 50),
  body('employmentType').optional().isIn(C.EMPLOYMENT_TYPES).withMessage(`employmentType must be one of ${C.EMPLOYMENT_TYPES.join(', ')}`),
  fk('designationId'), fk('departmentId'), fk('teamId'), fk('managerId'),
  str('jobTitle', 120), str('workLocation', 100),
  body('salary').optional({ values: 'null' }).isFloat({ min: 0, max: 99999999 }).withMessage('salary must be a non-negative number').toFloat(),
  body('bonusTarget').optional({ values: 'null' }).isFloat({ min: 0, max: 99999999 }).toFloat(),
  body('salaryCurrency').optional({ values: 'null' }).isISO4217().withMessage('salaryCurrency must be an ISO 4217 code'),
];

module.exports = {
  create: [
    ...fields(true),
    body('employeeCode').optional().matches(/^[A-Z0-9-]{3,20}$/).withMessage('employeeCode must be 3-20 chars of A-Z, 0-9, -'),
    body('account').optional().isObject(),
    body('account.role').if(body('account').exists()).isIn(C.ALL_ROLES).withMessage('account.role is invalid'),
    body('account.password').if(body('account').exists()).isString().custom((v) => pw.isStrong(v)).withMessage(pw.POLICY_MESSAGE),
  ],
  update: [
    idParam(), ...fields(false),
    body('changeType').optional().isIn(C.CHANGE_TYPES), dateField(body, 'effectiveDate', { optional: true }), str('notes', 500),
  ],
  id: [idParam()],
  list: [
    ...pageQuery,
    query('departmentId').optional().isInt({ min: 1 }).toInt(), query('teamId').optional().isInt({ min: 1 }).toInt(),
    query('designationId').optional().isInt({ min: 1 }).toInt(), query('managerId').optional().isInt({ min: 1 }).toInt(),
    query('status').optional().isIn([...C.EMPLOYEE_STATUS, 'ALL']), query('employmentType').optional().isIn(C.EMPLOYMENT_TYPES),
    query('q').optional().isString().isLength({ max: 100 }), query('sort').optional().isString().isLength({ max: 40 }),
  ],
  deactivate: [idParam(), str('reason', 300), dateField(body, 'exitDate', { optional: true }), fk('reassignReportsTo')],
  history: [idParam(), body('changeType').isIn(C.CHANGE_TYPES), dateField(body, 'effectiveDate'), str('notes', 500)],
  account: [idParam(), body('role').isIn(C.ALL_ROLES), passwordField('password')],
  role: [idParam(), body('role').isIn(C.ALL_ROLES)],
  profile: [
    body().custom((b) => !Object.keys(b).some((k) => !['personalEmail', 'phone', 'addressLine', 'city', 'state', 'country', 'postalCode', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'].includes(k)))
      .withMessage('Only personalEmail, phone, address and emergency-contact fields may be updated'),
    body('personalEmail').optional({ values: 'null' }).isEmail(),
    body('phone').optional({ values: 'null' }).matches(/^[+\d][\d\s().-]{5,28}$/),
    str('addressLine', 255), str('city', 100), str('state', 100), str('country', 100), str('postalCode', 20),
    str('emergencyContactName', 120), str('emergencyContactPhone', 30), str('emergencyContactRelation', 50),
  ],
};
