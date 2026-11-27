// ============================================================
// WHAT: Joi schema validation middleware
// WHY:  Always validate at the system boundary (user input).
//       Never trust req.body, req.params, or req.query.
// HOW:  validate() is a middleware factory. Pass a Joi schema;
//       it returns a middleware that validates the request body
//       and calls next(ValidationError) on failure.
// Interview Tip: Validate input early — fail fast before hitting the DB.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../exceptions';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,  // collect ALL errors, not just the first
      stripUnknown: true, // remove fields not in schema (security: prevent mass-assignment)
    });

    if (error) {
      const fields: Record<string, string> = {};
      error.details.forEach(d => {
        const key = d.path.join('.');
        fields[key] = d.message.replace(/['"]/g, '');
      });
      return next(new ValidationError('Validation failed', fields));
    }

    // Replace req.body with the sanitised value
    req.body = value;
    next();
  };
};

// Validate query params
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true, // coerce strings to numbers where schema says number
    });

    if (error) return next(new ValidationError(error.message));
    req.query = value;
    next();
  };
};
