import { HttpClient, HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, tap, throwError, map } from 'rxjs';
import { tokens } from '../auth/tokens';
import { APP } from '../config/app.config';
import { setOnline } from '../../state/zustand-style/connection.store';

const AUTH_FREE = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password'];
const isAuthFree = (url: string) => AUTH_FREE.some((p) => url.includes(p));
const withToken = (req: HttpRequest<unknown>, at: string | null) => (at ? req.clone({ setHeaders: { Authorization: `Bearer ${at}` } }) : req);

/** Single-flight refresh: concurrent 401s share ONE refresh call (refresh tokens rotate and re-use revokes the family). */
let refreshing$: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const free = isAuthFree(req.url);
  const send = (r: HttpRequest<unknown>) => next(r);
  return send(free ? req : withToken(req, tokens.access)).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || free) return throwError(() => err);
      const rt = tokens.refresh;
      if (!rt) { tokens.forceLogout(); return throwError(() => err); }
      if (!refreshing$) {
        refreshing$ = http.post<{ accessToken: string; refreshToken: string }>(`${APP.apiBaseUrl}/api/v1/auth/refresh`, { refreshToken: rt }).pipe(
          tap((r) => { tokens.set(r.accessToken, r.refreshToken); setOnline(true); }),
          map((r) => r.accessToken),
          finalize(() => { refreshing$ = null; }),
          shareReplay(1),
        );
      }
      return refreshing$.pipe(
        switchMap((at) => send(withToken(req, at))), // retried exactly once - a second 401 below is not refreshed again
        catchError((e) => {
          if (e instanceof HttpErrorResponse && e.status === 401) tokens.forceLogout();
          return throwError(() => e);
        }),
      );
    }),
  );
};
