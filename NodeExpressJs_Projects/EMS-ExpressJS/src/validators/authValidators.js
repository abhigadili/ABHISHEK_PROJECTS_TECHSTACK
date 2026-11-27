const { body, query } = require('express-validator');
const { passwordField, dateField } = require('./common');

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const optionalId = (n) => body(n).optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage(`${n} must be a positive integer`).toInt();

module.exports = {
  // Login accepts the registered username OR the e-mail address (one of the two is required).
  login: [
    body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body('username').optional({ values: 'falsy' }).isString().trim().toLowerCase().isLength({ min: 3, max: 30 }).withMessage('username must be 3-30 characters'),
    body().custom((b) => !!(b.email || b.username)).withMessage('email or username is required'),
    body('password').isString().notEmpty(),
  ],
  refresh: [body('refreshToken').isString().isLength({ min: 20, max: 200 })],
  logout: [body('refreshToken').isString().isLength({ min: 20, max: 200 })],
  forgot: [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false })],
  reset: [body('token').isString().isLength({ min: 20, max: 200 }), passwordField('newPassword')],
  change: [body('currentPassword').isString().notEmpty(), passwordField('newPassword')],

  // Public self-registration (multipart/form-data, optional `file`). confirmPassword is intentionally NOT part of the contract.
  register: [
    body('firstName').isString().trim().isLength({ min: 1, max: 60 }).withMessage('firstName is required (max 60)').matches(NAME_RE).withMessage('firstName contains invalid characters'),
    body('lastName').isString().trim().isLength({ min: 1, max: 60 }).withMessage('lastName is required (max 60)').matches(NAME_RE).withMessage('lastName contains invalid characters'),
    body('username').isString().trim().toLowerCase().matches(USERNAME_RE).withMessage('username must be 3-30 characters: letters, digits, dot, underscore or hyphen, starting with a letter or digit'),
    body('email').isString().trim().isEmail().withMessage('email must be a valid email address').isLength({ max: 190 }).customSanitizer((v) => v.toLowerCase()),
    body('mobile').isString().trim().matches(/^[+\d][\d\s().-]{5,28}$/).withMessage('mobile is not a valid phone number'),
    passwordField('password'),
    dateField(body, 'dateOfBirth').custom((v) => new Date(v) < new Date() && new Date(v) > new Date('1900-01-01')).withMessage('dateOfBirth must be a past date after 1900'),
    body('gender').isIn(GENDERS).withMessage(`gender must be one of ${GENDERS.join(', ')}`),
    body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }).withMessage('address must be at most 255 characters'),
    optionalId('departmentId'), optionalId('designationId'),
  ],
  usernameAvailable: [query('username').isString().trim().toLowerCase().matches(USERNAME_RE).withMessage('username is not valid')],
};
