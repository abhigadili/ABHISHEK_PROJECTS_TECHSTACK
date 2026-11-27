const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Append after a validator chain array; turns failures into a 400 with field details. */
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg, location: e.location }));
  next(ApiError.badRequest('Validation failed', details, 'VALIDATION_ERROR'));
};
