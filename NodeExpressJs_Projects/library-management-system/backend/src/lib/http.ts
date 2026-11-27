import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodType } from 'zod';
import { badRequest } from './errors';

export const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export function parse<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
    throw badRequest('Validation failed', fields);
  }
  return r.data;
}

export const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ data });
export const page = (res: Response, rows: unknown[], p: Pagination, total: number) =>
  res.json({ data: rows, meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) } });

export interface Pagination { page: number; pageSize: number; offset: number }
export function pagination(q: Record<string, unknown>, defaultSize = 20, max = 100): Pagination {
  const pageN = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
  const size = Math.min(max, Math.max(1, parseInt(String(q.pageSize ?? defaultSize), 10) || defaultSize));
  return { page: pageN, pageSize: size, offset: (pageN - 1) * size };
}

export const idParam = (req: Request, name = 'id'): number => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
};

export const clientIp = (req: Request) => (req.ip ?? '').slice(0, 64);

// Reusable zod pieces. Empty strings from forms are treated as "not provided".
export const emptyToNull = <T extends ZodType>(s: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), s.nullable());
export const optStr = (max: number) => emptyToNull(z.string().trim().max(max));
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');
export const optDate = emptyToNull(isoDate);
export const money = z.coerce.number().finite().min(0).max(1_000_000).transform((n) => Math.round(n * 100) / 100);
