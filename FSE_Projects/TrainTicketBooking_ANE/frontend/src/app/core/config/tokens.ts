import { InjectionToken, inject } from '@angular/core';
import { HttpContextToken } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Centralised API base URL (environment provider). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { providedIn: 'root', factory: () => environment.apiBaseUrl });
export interface AppConfig { production: boolean; notificationPollSeconds: number; enableHttpLogging: boolean; maxPassengers: number }
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', { providedIn: 'root', factory: () => ({ production: environment.production, notificationPollSeconds: environment.notificationPollSeconds, enableHttpLogging: environment.enableHttpLogging, maxPassengers: 6 }) });

/** Navigation contributions: a multi-provider token, every feature can contribute links. */
export interface NavLink { label: string; icon: string; path: string; area: 'passenger' | 'admin'; permission?: string; order: number }
export const NAV_LINKS = new InjectionToken<NavLink[][]>('NAV_LINKS');
export const injectNavLinks = (area: NavLink['area']) => (inject(NAV_LINKS, { optional: true }) ?? []).flat().filter((l) => l.area === area).sort((a, b) => a.order - b.order);

/** Per-request switches carried in the HttpContext. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);
export const IS_RETRY = new HttpContextToken<boolean>(() => false);
