import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const API = 'http://api.test/api/v1';

/** Envelope helpers that mirror the backend contract (docs/backend-api-integration.md). */
export const ok = <T>(data: T, meta?: unknown) =>
  HttpResponse.json({ success: true, message: 'ok', data, ...(meta ? { meta } : {}) });
export const fail = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ success: false, error: { code, message, details, requestId: 'req-test' } }, { status });
export const page = <T>(items: T[], p = 1, limit = 10, total = items.length) =>
  ok(items, { page: p, limit, total, totalPages: Math.ceil(total / limit) || 0 });

export const server = setupServer();
export { http, HttpResponse };
