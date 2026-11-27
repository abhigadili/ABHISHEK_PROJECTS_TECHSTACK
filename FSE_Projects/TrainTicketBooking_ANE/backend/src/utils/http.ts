import type { NextFunction, Request, RequestHandler, Response } from 'express';
/** Wraps async handlers so rejected promises reach the error middleware (Express 5 does this natively; kept for typed handlers). */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler => (req, res, next) => { fn(req, res, next).catch(next); };
export interface PageMeta { page: number; size: number; total: number; totalPages: number }
/** Standard response envelope: { success, data, meta? } */
export const ok = <T,>(res: Response, data: T, meta?: PageMeta, status = 200) => res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
export const created = <T,>(res: Response, data: T) => ok(res, data, undefined, 201);
export const paged = <T,>(res: Response, items: T[], total: number, page: number, size: number) => ok(res, items, { page, size, total, totalPages: Math.max(1, Math.ceil(total / size)) });
export const idParam = (v: string | undefined, what = 'id') => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new Error(`INVALID_ID:${what}`); return n; };
