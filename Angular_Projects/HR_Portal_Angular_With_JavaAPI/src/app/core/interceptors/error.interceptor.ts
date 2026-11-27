import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError, timeout, TimeoutError } from 'rxjs';
import { ApiError, type FieldError } from '../models/api-error';
import { APP } from '../config/app.config';
import { setOnline } from '../../state/zustand-style/connection.store';

const FALLBACK: Record<number, string> = { 401: 'Your session has expired.', 403: 'You do not have permission to do that.', 404: 'Not found.', 429: 'Too many requests - please slow down.', 502: 'The service is unavailable.', 503: 'The service is unavailable.' };

function normalise(err: HttpErrorResponse, body: any): ApiError {
  let fieldErrors: FieldError[] = [];
  if (Array.isArray(body?.fieldErrors)) fieldErrors = body.fieldErrors.map((f: any) => ({ field: String(f.field ?? ''), message: String(f.message ?? f.defaultMessage ?? 'Invalid') }));
  else if (body?.fieldErrors && typeof body.fieldErrors === 'object') fieldErrors = Object.entries(body.fieldErrors).map(([field, message]) => ({ field, message: String(message) }));
  return new ApiError({
    status: err.status, code: body?.code, fieldErrors, correlationId: body?.correlationId,
    message: (typeof body === 'object' && body?.message) || FALLBACK[err.status] || `Request failed (${err.status})`,
  });
}

/**
 * Outermost interceptor: request timeout, backend reachability flag and conversion of every failure into one `ApiError`
 * (blob error bodies from download endpoints are decoded so the real message is shown).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout(APP.requestTimeoutMs),
    catchError((err) => {
      if (err instanceof TimeoutError) { return throwError(() => new ApiError({ status: 0, network: true, message: 'The server took too long to respond.' })); }
      if (err instanceof ApiError) return throwError(() => err);
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      if (err.status === 0) {
        const e = new ApiError({ status: 0, network: true, message: 'Cannot reach the HR API. Check that the backend gateway is running.' });
        setOnline(false, e.message);
        return throwError(() => e);
      }
      setOnline(true);
      if (err.error instanceof Blob) {
        return from(err.error.text()).pipe(
          switchMap((t) => { let b: any = null; try { b = JSON.parse(t); } catch { /* not json */ } return throwError(() => normalise(err, b)); }),
        );
      }
      return throwError(() => normalise(err, err.error));
    }),
  );
