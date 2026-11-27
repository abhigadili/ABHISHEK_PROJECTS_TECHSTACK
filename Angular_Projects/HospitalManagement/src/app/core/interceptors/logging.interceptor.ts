import { HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { LOGGER } from '../configuration/app-config';

/** Logging interceptor: method, URL, status and duration of each request (debug level – silent in production). */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(LOGGER);
  const started = performance.now();
  return next(req).pipe(
    tap({
      next: (ev) => {
        if (ev.type === HttpEventType.Response) log.debug(`${req.method} ${req.urlWithParams} → ${ev.status} (${Math.round(performance.now() - started)} ms)`);
      },
      error: (e) => log.warn(`${req.method} ${req.urlWithParams} failed`, e),
    }),
  );
};
