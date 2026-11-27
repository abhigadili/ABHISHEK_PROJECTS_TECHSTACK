import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { APP_CONFIG } from '../config/tokens';

/** Development-only request log (method, URL, status, duration). Never logs bodies or headers (credentials / payment data). */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!inject(APP_CONFIG).enableHttpLogging) return next(req);
  const t = performance.now();
  return next(req).pipe(tap({
    next: (e) => { if (e instanceof HttpResponse) console.debug(`[http] ${req.method} ${req.urlWithParams} -> ${e.status} (${Math.round(performance.now() - t)}ms)`); },
    error: (e) => console.debug(`[http] ${req.method} ${req.urlWithParams} -> ERROR ${e?.status} (${Math.round(performance.now() - t)}ms)`),
  }));
};
