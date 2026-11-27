import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, defer, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TokenStoreService } from '../auth/token-store.service';
import { SKIP_AUTH } from './http-context';

const withBearer = (req: HttpRequest<unknown>, token: string | null) => (token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);

/**
 * Functional authentication interceptor: JWT injection + refresh-token handling.
 * 401 → one shared refresh (AuthService.refresh) → replay the original request with the new token.
 * Requests marked with HttpContext SKIP_AUTH (login, register, refresh, logout) pass untouched.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) return next(req);
  const auth = inject(AuthService);
  const tokens = inject(TokenStoreService);
  // defer(): the token is read when the request is SUBSCRIBED (not when the interceptor runs), so a retry always carries the newest token
  return defer(() => next(withBearer(req, tokens.accessToken))).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && tokens.refreshToken) {
        return auth.refresh().pipe(
          switchMap((t) => next(withBearer(req, t.accessToken))),
        );
      }
      if (err instanceof HttpErrorResponse && err.status === 401) auth.logout('expired').subscribe();
      return throwError(() => err);
    }),
  );
};
export type _AuthNext = HttpHandlerFn;
