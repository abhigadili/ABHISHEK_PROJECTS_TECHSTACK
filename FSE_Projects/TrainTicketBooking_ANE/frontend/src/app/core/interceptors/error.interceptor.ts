import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { SKIP_ERROR_TOAST } from '../config/tokens';
import { ToastService } from '../services/toast.service';
import type { ApiErrorBody } from '../models/models';

/** Normalised error thrown to callers. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}
export const toApiError = (e: unknown): ApiError => {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpErrorResponse) {
    const body = (e.error as { error?: ApiErrorBody } | null)?.error;
    if (e.status === 0) return new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
    return new ApiError(e.status, body?.code ?? 'ERROR', body?.message ?? e.statusText ?? 'Request failed', body?.fields);
  }
  return new ApiError(-1, 'UNKNOWN', e instanceof Error ? e.message : 'Unexpected error');
};

/**
 * Global error handling: idempotent GETs retry network blips / 5xx with back-off; everything is mapped to ApiError; a toast
 * is shown for network, 403, 5xx and 429 failures (validation and 401 are handled by the caller / auth interceptor).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const retriable = req.method === 'GET';
  return next(req).pipe(
    retry({ count: retriable ? 2 : 0, delay: (err, n) => (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500) ? timer(300 * 2 ** n) : throwError(() => err)) }),
    catchError((e: unknown) => {
      const err = toApiError(e);
      if (!req.context.get(SKIP_ERROR_TOAST)) {
        if (err.status === 0 || err.status >= 500) toast.error(err.message);
        else if (err.status === 403) toast.error('You do not have permission to do that.');
        else if (err.status === 429) toast.error(err.message);
      }
      return throwError(() => err);
    }),
  );
};
