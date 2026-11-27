import axios, { type AxiosError } from 'axios';
import type { ApiErrorBody } from '@/types';

/** Normalised error thrown by every API call (axios and fetch). */
export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];
  readonly fieldErrors: Record<string, string>;
  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;
  readonly path?: string;
  readonly correlationId?: string;

  constructor(opts: {
    status: number;
    message: string;
    details?: string[];
    isNetworkError?: boolean;
    isTimeout?: boolean;
    path?: string;
    correlationId?: string;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.details = opts.details ?? [];
    this.fieldErrors = parseFieldErrors(this.details);
    this.isNetworkError = opts.isNetworkError ?? false;
    this.isTimeout = opts.isTimeout ?? false;
    this.path = opts.path;
    this.correlationId = opts.correlationId;
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }
  get isServerError() {
    return this.status >= 500;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isConflict() {
    return this.status === 409;
  }
}

/** Backend validation details look like "email: must be a well-formed email address". */
export function parseFieldErrors(details: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details) {
    const i = d.indexOf(':');
    if (i > 0) {
      const field = d.slice(0, i).trim();
      if (/^[\w.[\]]+$/.test(field) && !(field in out)) out[field] = d.slice(i + 1).trim();
    }
  }
  return out;
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function isAbortError(e: unknown): boolean {
  return axios.isCancel(e) || (e instanceof DOMException && e.name === 'AbortError') || (e instanceof Error && e.name === 'CanceledError');
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    const err = e as AxiosError<ApiErrorBody>;
    const correlationId = err.response?.headers?.['x-correlation-id'] as string | undefined;
    if (err.response) {
      const body = err.response.data;
      const isObj = body && typeof body === 'object';
      return new ApiError({
        status: err.response.status,
        message: (isObj && body.message) || err.response.statusText || `Request failed (${err.response.status})`,
        details: isObj && Array.isArray(body.details) ? body.details : [],
        path: isObj ? body.path : undefined,
        correlationId,
      });
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new ApiError({ status: 0, message: 'The request timed out. Please try again.', isTimeout: true, isNetworkError: true });
    }
    return new ApiError({ status: 0, message: 'Cannot reach the server. Check your connection and that the backend is running.', isNetworkError: true });
  }
  if (e instanceof Error) return new ApiError({ status: 0, message: e.message });
  return new ApiError({ status: 0, message: 'Unexpected error' });
}

/** Human friendly message for toasts / alerts. */
export function errorMessage(e: unknown): string {
  const err = toApiError(e);
  if (err.status === 403) return 'You do not have permission to perform this action.';
  if (err.status === 503) return err.message || 'A dependent service is temporarily unavailable. Please retry shortly.';
  if (err.details.length > 0 && err.status === 400) return `${err.message}: ${err.details.join('; ')}`;
  return err.message;
}
