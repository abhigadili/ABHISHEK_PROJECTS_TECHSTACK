import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from './common';

/** Normalised error produced by the global error interceptor (HTTP Error Handling). */
export class ApiError extends Error {
  readonly fieldErrors: Readonly<Record<string, string>>;
  constructor(
    readonly status: number,
    override readonly message: string,
    readonly details: readonly string[] = [],
    readonly isNetworkError = false,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    const fe: Record<string, string> = {};
    for (const d of details) {
      const i = d.indexOf(':');
      if (i > 0) {
        const k = d.slice(0, i).trim();
        if (/^[\w.[\]]+$/.test(k) && !(k in fe)) fe[k] = d.slice(i + 1).trim();
      }
    }
    this.fieldErrors = fe;
  }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isConflict() { return this.status === 409; }
  get isServerError() { return this.status >= 500; }

  static from(e: unknown): ApiError {
    if (e instanceof ApiError) return e;
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) return new ApiError(0, 'Cannot reach the server. Check your connection and that the backend is running.', [], true);
      const body = (typeof e.error === 'object' && e.error ? e.error : {}) as Partial<ApiErrorBody>;
      return new ApiError(e.status, body.message ?? e.statusText ?? `Request failed (${e.status})`, body.details ?? [], false, e.headers?.get('x-correlation-id') ?? undefined);
    }
    return new ApiError(0, e instanceof Error ? e.message : 'Unexpected error');
  }
}

/** Type guard (TypeScript: type narrowing). */
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Friendly message for toasts / error states. */
export function errorMessage(e: unknown): string {
  const err = ApiError.from(e);
  if (err.isForbidden) return 'You do not have permission to perform this action.';
  if (err.status === 400 && err.details.length) return `${err.message}: ${err.details.join('; ')}`;
  return err.message;
}

/** Discriminated union used by every async view (TypeScript: discriminated unions, literal types). */
export type LoadState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly data: T }
  | { readonly status: 'error'; readonly error: ApiError };
