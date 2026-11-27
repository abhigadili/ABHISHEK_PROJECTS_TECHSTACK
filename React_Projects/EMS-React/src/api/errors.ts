import type { ApiFieldError } from '@/types/api';

/** The single error type the UI deals with, whatever transport (Axios / fetchBaseQuery) produced it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiFieldError[];
  readonly requestId?: string;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: ApiFieldError[];
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  get isNetwork() {
    return this.status === 0;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: ApiFieldError[]; requestId?: string };
}

/** Turn an HTTP status + (possibly absent) backend error envelope into an ApiError. */
export function toApiError(status: number, body: unknown, fallbackMessage?: string): ApiError {
  const e = (body as ErrorBody | undefined)?.error;
  const defaults: Record<number, string> = {
    0: 'Cannot reach the server. Check your connection and try again.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested record could not be found.',
    409: 'This conflicts with existing data.',
    422: 'The request could not be processed.',
    429: 'Too many requests. Please wait a moment.',
  };
  return new ApiError({
    status,
    code: e?.code ?? (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`),
    message:
      e?.message ??
      fallbackMessage ??
      defaults[status] ??
      (status >= 500 ? 'The server had a problem. Please try again.' : 'Request failed.'),
    details: e?.details,
    requestId: e?.requestId,
  });
}

/** Structural shape shared by `ApiError` (Axios path) and the plain serialisable object RTK Query rejects with. */
export interface ApiErrorLike {
  status: number;
  code: string;
  message: string;
  details?: ApiFieldError[];
  requestId?: string;
}

/**
 * Duck-typed on purpose: `instanceof ApiError` would miss RTK Query errors (Redux state must stay serialisable, so they are plain
 * objects), and server-side field errors / 409 handling would silently stop working for every RTK-powered form.
 */
export const isApiError = (e: unknown): e is ApiErrorLike =>
  typeof e === 'object' &&
  e !== null &&
  typeof (e as ApiErrorLike).status === 'number' &&
  typeof (e as ApiErrorLike).code === 'string' &&
  typeof (e as ApiErrorLike).message === 'string';

/** Best-effort message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e)
    return String((e as { message: unknown }).message);
  return 'Something went wrong.';
}

/** Per-field messages from a VALIDATION_ERROR, keyed by field name (used to push server errors into React Hook Form). */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (isApiError(e))
    e.details?.forEach((d) => {
      out[d.field] ??= d.message;
    });
  return out;
}
