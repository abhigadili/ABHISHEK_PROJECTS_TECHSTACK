import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Per-request opt-outs. Set through `ApiService` options or `new HttpContext().set(...)`. */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const SKIP_REFRESH = new HttpContextToken<boolean>(() => false);
/** Suppress the global error snackbar (the caller renders its own inline error). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

export interface RequestOptions {
  skipLoading?: boolean;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  skipErrorToast?: boolean;
  /** Retry transient GET failures (network/5xx). Defaults to true for GET. */
  retry?: boolean;
}

export function contextFrom(o: RequestOptions = {}): HttpContext {
  return new HttpContext()
    .set(SKIP_LOADING, !!o.skipLoading)
    .set(SKIP_AUTH, !!o.skipAuth)
    .set(SKIP_REFRESH, !!o.skipRefresh)
    .set(SKIP_ERROR_TOAST, !!o.skipErrorToast);
}
