import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/api-error';
import { NotificationService } from '../services/notification.service';
import { SILENT_ERRORS } from './http-context';

/**
 * Global error interceptor: converts every HttpErrorResponse into an ApiError and reports the cross-cutting cases
 * (network down, 403, 5xx) once, centrally. Callers keep handling domain-specific errors (400/404/409) themselves.
 * Requests with HttpContext SILENT_ERRORS skip the toast.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  return next(req).pipe(
    catchError((e: unknown) => {
      const err = e instanceof HttpErrorResponse ? ApiError.from(e) : ApiError.from(e);
      if (!req.context.get(SILENT_ERRORS)) {
        if (err.isNetworkError) notify.error(err.message, 'network');
        else if (err.isForbidden) notify.error('You do not have permission to perform this action.', 'forbidden');
        else if (err.isServerError) notify.error(err.message || 'The server reported an error. Please retry.', `5xx-${err.status}`);
      }
      return throwError(() => err);
    }),
  );
};
