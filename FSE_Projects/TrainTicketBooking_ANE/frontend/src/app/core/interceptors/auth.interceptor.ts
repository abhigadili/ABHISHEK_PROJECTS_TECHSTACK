import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { IS_RETRY, SKIP_AUTH } from '../config/tokens';

const withToken = (req: HttpRequest<unknown>, token: string) => req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/** Attaches the bearer token to non-public calls; on 401 refreshes once (shared across requests) and retries the request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (req.context.get(SKIP_AUTH)) return next(req);
  const token = auth.token();
  const outgoing = token ? withToken(req, token) : req;
  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || req.context.get(IS_RETRY) || !token) return throwError(() => err);
      return auth.refresh().pipe(
        switchMap((s) => next(withToken(req.clone({ context: req.context.set(IS_RETRY, true) }), s.accessToken))),
        catchError((refreshErr) => {
          auth.clear('expired');
          void router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url, expired: 1 } });
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
