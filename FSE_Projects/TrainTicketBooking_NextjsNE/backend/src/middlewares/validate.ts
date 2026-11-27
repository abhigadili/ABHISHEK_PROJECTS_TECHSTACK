import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
/** Request validation: parses body/query/params with a Zod schema; the parsed (typed, coerced) value replaces the raw input. */
export const validate = (source: 'body' | 'query', schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(source === 'body' ? req.body : req.query);
  if (!r.success) return next(r.error);
  if (source === 'body') req.body = r.data; else (req as Request & { validatedQuery?: unknown }).validatedQuery = r.data;
  next();
};
export const q = <T,>(req: Request) => (req as Request & { validatedQuery?: unknown }).validatedQuery as T;
