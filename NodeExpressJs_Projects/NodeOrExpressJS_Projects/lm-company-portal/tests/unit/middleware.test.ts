// ============================================================
// Unit tests for middleware functions
// WHAT: Tests authorize and validate middleware in isolation.
// HOW:  Uses Jest mock functions for req, res, next — no real HTTP.
// ============================================================

import { authorize } from '../../src/middlewares/authorize.middleware';
import { validate } from '../../src/middlewares/validate.middleware';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../src/exceptions';
import { AuthRequest } from '../../src/types';
import Joi from 'joi';

const mockNext = jest.fn();
const mockRes  = {} as any;

beforeEach(() => mockNext.mockClear());

describe('authorize middleware', () => {

  it('calls next(UnauthorizedError) when req.user is missing', () => {
    const req = {} as AuthRequest;
    authorize(['Admin'])(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next(ForbiddenError) when role is not allowed', () => {
    const req = { user: { role: 'Guest', permissions: [] } } as any;
    authorize(['Admin'])(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next() (no error) when role is allowed', () => {
    const req = { user: { role: 'Admin', permissions: [] } } as any;
    authorize(['Admin', 'SuperAdmin'])(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(); // called with no arguments = success
  });
});

describe('validate middleware', () => {
  const schema = Joi.object({ name: Joi.string().required(), age: Joi.number().min(0) });

  it('calls next(ValidationError) on invalid body', () => {
    const req = { body: { age: -1 } } as any; // missing name, negative age
    validate(schema)(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('calls next() and sanitises body on valid input', () => {
    const req = { body: { name: 'Alice', age: 30, extra: 'stripped' } } as any;
    validate(schema)(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(req.body.extra).toBeUndefined(); // stripUnknown removes extra fields
    expect(req.body.name).toBe('Alice');
  });
});
