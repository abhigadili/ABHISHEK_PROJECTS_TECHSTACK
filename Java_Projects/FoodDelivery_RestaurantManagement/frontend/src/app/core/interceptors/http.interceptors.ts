import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

let refreshing = false;
const refreshed$ = new BehaviorSubject<string | null>(null);

/** Adds the bearer token and a fresh X-Correlation-Id (so every click can be traced in logs and Kafka audit). Refreshes once on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isAuthCall = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/refresh') || req.url.includes('/api/auth/register');
  const withHeaders = (token: string | null) => req.clone({
    setHeaders: { 'X-Correlation-Id': crypto.randomUUID(), ...(token && !isAuthCall ? { Authorization: `Bearer ${token}` } : {}) }
  });
  return next(withHeaders(auth.accessToken())).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status !== 401 || isAuthCall || !auth.refreshToken()) return throwError(() => err);
    if (!refreshing) {
      refreshing = true;
      refreshed$.next(null);
      return auth.refresh().pipe(
        switchMap(r => { refreshing = false; refreshed$.next(r.accessToken); return next(withHeaders(r.accessToken)); }),
        catchError(e => { refreshing = false; auth.expireSession(); return throwError(() => e); }));
    }
    return refreshed$.pipe(filter(t => t !== null), take(1), switchMap(t => next(withHeaders(t))));
  }));
};

/** Shows the backend's standard error message once; components can still handle the error themselves. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  return next(req).pipe(catchError((err: HttpErrorResponse) => {
    const silent = req.headers.has('X-Silent') || err.status === 401;
    if (!silent) {
      const e = err.error;
      const msg = e?.details ? Object.values(e.details).join(' · ') : e?.message ?? (err.status === 0 ? 'Cannot reach the server' : `Request failed (${err.status})`);
      snack.open(msg as string, 'Close', { duration: 6000, panelClass: 'error-snack' });
    }
    return throwError(() => err);
  }));
};
