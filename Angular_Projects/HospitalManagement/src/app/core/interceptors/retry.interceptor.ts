import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';
import { RETRY_COUNT } from './http-context';

const RETRYABLE = new Set([0, 502, 503, 504]);

/** API retry strategy: idempotent GETs are retried on network errors / 502 / 503 / 504 with exponential back-off (HttpContext RETRY_COUNT configures it). */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const count = req.context.get(RETRY_COUNT);
  if (req.method !== 'GET' || count <= 0) return next(req);
  return next(req).pipe(
    retry({
      count,
      delay: (err: unknown, attempt) => {
        if (err instanceof HttpErrorResponse && RETRYABLE.has(err.status)) return timer(300 * 2 ** (attempt - 1));
        throw err;
      },
    }),
  );
};
