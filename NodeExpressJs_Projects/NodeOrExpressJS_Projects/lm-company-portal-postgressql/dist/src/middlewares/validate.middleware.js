"use strict";
// ============================================================
// WHAT: Joi schema validation middleware
// WHY:  Always validate at the system boundary (user input).
//       Never trust req.body, req.params, or req.query.
// HOW:  validate() is a middleware factory. Pass a Joi schema;
//       it returns a middleware that validates the request body
//       and calls next(ValidationError) on failure.
// Interview Tip: Validate input early — fail fast before hitting the DB.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validate = void 0;
const exceptions_1 = require("../exceptions");
const validate = (schema) => {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // collect ALL errors, not just the first
            stripUnknown: true, // remove fields not in schema (security: prevent mass-assignment)
        });
        if (error) {
            const fields = {};
            error.details.forEach(d => {
                const key = d.path.join('.');
                fields[key] = d.message.replace(/['"]/g, '');
            });
            return next(new exceptions_1.ValidationError('Validation failed', fields));
        }
        // Replace req.body with the sanitised value
        req.body = value;
        next();
    };
};
exports.validate = validate;
// Validate query params
const validateQuery = (schema) => {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
            convert: true, // coerce strings to numbers where schema says number
        });
        if (error)
            return next(new exceptions_1.ValidationError(error.message));
        req.query = value;
        next();
    };
};
exports.validateQuery = validateQuery;
