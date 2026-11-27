import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of the Express API. Provided at root from the environment file; tests/feature routes can override it. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

export interface AppConfig {
  readonly apiTimeoutMs: number;
  readonly notificationPollMs: number;
  readonly defaultPageSize: number;
  readonly pageSizeOptions: readonly number[];
}

/** Tunable runtime configuration, derived from environment files. */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    apiTimeoutMs: environment.apiTimeoutMs,
    notificationPollMs: environment.notificationPollMs,
    defaultPageSize: 10,
    pageSizeOptions: [5, 10, 25, 50],
  }),
});

/** Abstraction over Web Storage so services stay testable (swap for an in-memory fake in specs). */
export const BROWSER_STORAGE = new InjectionToken<Storage>('BROWSER_STORAGE', {
  providedIn: 'root',
  factory: () => localStorage,
});

/** sessionStorage flavour, used for the refresh token (cleared when the tab closes). */
export const SESSION_STORAGE = new InjectionToken<Storage>('SESSION_STORAGE', {
  providedIn: 'root',
  factory: () => sessionStorage,
});
