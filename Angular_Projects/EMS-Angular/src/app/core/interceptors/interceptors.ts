import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';
import { isAppError, toAppError } from '../errors/app-error';
import { AuthService } from '../services/auth.service';
import { LoadingService } from '../services/loading.service';
import { ToastService } from '../services/toast.service';
import { API_BASE_URL } from '../tokens/tokens';
import { SKIP_AUTH, SKIP_ERROR_TOAST, SKIP_LOADING, SKIP_REFRESH } from './http-context';

/** True only for requests aimed at OUR backend — credentials and ids are never sent to third-party URLs. */
const isApiRequest = (url: string, base: string): boolean => url === base || url.startsWith(`${base}/`);

/**
 * 1. Correlation id (X-Request-Id). Only added for SAME-ORIGIN API calls (relative base URL, i.e. dev proxy / reverse proxy).
 * The backend's CORS allow-list is just Content-Type + Authorization, so a custom request header on a cross-origin call
 * would fail the preflight and break every request. The backend generates its own id and returns it in the error body.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const sameOrigin = base.startsWith('/');
  if (!sameOrigin || !isApiRequest(req.url, base) || req.headers.has('X-Request-Id')) return next(req);
  return next(req.clone({ setHeaders: { 'X-Request-Id': crypto.randomUUID() } }));
};

/** 2. Loading: drives the global progress bar; a request can opt out with SKIP_LOADING (polling, background refresh). */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING)) return next(req);
  const loading = inject(LoadingService);
  loading.begin();
  return next(req).pipe(finalize(() => loading.end()));
};

/** 3. Error: normalises every failure to AppError and shows exactly one toast per failed request. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      const appError = toAppError(err);
      const silent = req.context.get(SKIP_ERROR_TOAST);
      if (!silent) {
        switch (appError.status) {
          case 0:
            toast.error(appError.message);
            break;
          case 401:
            break; // handled by the refresh interceptor / login screen
          case 403:
            toast.error('You do not have permission to do that.');
            break;
          case 404:
            // 404s on GETs are usually rendered by the page itself (empty state); only toast for writes.
            if (req.method !== 'GET') toast.error(appError.message);
            break;
          case 409:
            toast.error(appError.message || 'This conflicts with existing data.');
            break;
          case 422:
            toast.error(appError.message || 'The request could not be processed.');
            break;
          case 400:
            // field-level details are shown on the form; only toast when there are none.
            if (appError.details.length === 0) toast.error(appError.message);
            break;
          default:
            toast.error(appError.status >= 500 ? `Server error. Please try again. (ref ${appError.requestId ?? 'n/a'})` : appError.message);
        }
      }
      return throwError(() => appError);
    }),
  );
};

/** 4. Auth: attaches the Bearer token to backend requests only. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const auth = inject(AuthService);
  const token = auth.getAccessToken();
  if (!token || req.context.get(SKIP_AUTH) || !isApiRequest(req.url, base)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * 5. Refresh: on a 401 from a token problem, get ONE new access token (shared by every concurrent failure) and replay
 * the original request once. A request that already is a refresh/login call (SKIP_REFRESH) never recurses, and a failed
 * refresh ends the session — so there is no infinite loop. Only idempotent-safe because the clone is replayed once.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      const eligible =
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        isApiRequest(req.url, base) &&
        !req.context.get(SKIP_REFRESH) &&
        !req.context.get(SKIP_AUTH);
      if (!eligible) return throwError(() => err);

      const code = (err.error as { error?: { code?: string } } | null)?.error?.code;
      if (code === 'ACCOUNT_DISABLED') {
        auth.expireSession(router.url);
        return throwError(() => err);
      }
      return auth.refreshAccessToken().pipe(
        switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        catchError((refreshErr: unknown) => {
          // Refresh failed for good (401/400 from /auth/refresh, no refresh token) or the replay was rejected again → session over.
          // A network error (status 0) keeps the session so the user can retry once back online.
          const status = isAppError(refreshErr) ? refreshErr.status : refreshErr instanceof HttpErrorResponse ? refreshErr.status : -1;
          if (status === 401 || status === 400 || status === -1) auth.expireSession(router.url);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
