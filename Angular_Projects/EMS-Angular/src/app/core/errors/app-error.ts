import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, AppError } from '../models/api.models';

export const isAppError = (e: unknown): e is AppError =>
  typeof e === 'object' && e !== null && 'status' in e && 'code' in e && 'message' in e && 'details' in e;

/** Converts anything thrown by HttpClient/RxJS into the uniform AppError the UI understands. */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ApiErrorBody> | null;
    if (body && typeof body === 'object' && body.error) {
      return {
        status: err.status,
        code: body.error.code,
        message: body.error.message,
        details: body.error.details ?? [],
        requestId: body.error.requestId,
      };
    }
    if (err.status === 0) {
      return { status: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the server. Check your connection and that the API is running.', details: [] };
    }
    return { status: err.status, code: 'HTTP_ERROR', message: err.statusText || 'Request failed', details: [] };
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return { status: 0, code: 'TIMEOUT', message: 'The server took too long to respond.', details: [] };
  }
  return { status: 0, code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Unexpected error', details: [] };
}

/** Returns the first server-side validation message for a field, if any (used to surface backend validation on forms). */
export const fieldError = (e: AppError, field: string): string | null => e.details.find((d) => d.field === field)?.message ?? null;
