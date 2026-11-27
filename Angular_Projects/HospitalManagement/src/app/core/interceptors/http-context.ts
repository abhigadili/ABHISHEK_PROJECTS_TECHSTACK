import { HttpContextToken } from '@angular/common/http';

/** HttpContext-based per-request configuration (read by the interceptors). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);
/** Max automatic retries for idempotent GETs; 0 disables. */
export const RETRY_COUNT = new HttpContextToken<number>(() => 1);
