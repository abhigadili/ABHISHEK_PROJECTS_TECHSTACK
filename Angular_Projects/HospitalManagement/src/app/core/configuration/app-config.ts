import { InjectionToken, forwardRef, Injectable, inject, Provider } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Dependency Injection – configuration tokens (InjectionToken, useValue, useFactory, useClass, useExisting, forwardRef). */
export interface AppConfig {
  readonly production: boolean;
  readonly apiBaseUrl: string;
  readonly apiTimeoutMs: number;
  readonly idleLogoutMinutes: number;
  readonly zoneless: boolean;
}

/** useValue: a plain configuration object built from the environment file. */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => ({ ...environment }),
});

/** useFactory: derived value that depends on another token (`inject()` inside the factory). */
export const API_PREFIX = new InjectionToken<string>('API_PREFIX', {
  providedIn: 'root',
  factory: () => `${inject(APP_CONFIG).apiBaseUrl}/api`,
});

/** Token for the default page size – overridden at ROUTE level (see patients.routes.ts) to show hierarchical injectors. */
export const DEFAULT_PAGE_SIZE = new InjectionToken<number>('DEFAULT_PAGE_SIZE', { providedIn: 'root', factory: () => 10 });

/* ---------- useClass: swap an implementation per environment ---------- */
export interface Logger {
  debug(message: string, ...data: unknown[]): void;
  info(message: string, ...data: unknown[]): void;
  warn(message: string, ...data: unknown[]): void;
  error(message: string, ...data: unknown[]): void;
}
export const LOGGER = new InjectionToken<Logger>('LOGGER');
/** TypeScript ENUM (numeric): ordered severities; a logger prints a message when its level >= the logger's minimum. */
export enum LogLevel { Debug = 0, Info = 1, Warn = 2, Error = 3 }

export class ConsoleLogger implements Logger {
  protected readonly minLevel: LogLevel = LogLevel.Debug;
  private enabled(l: LogLevel) { return l >= this.minLevel; }
  debug(m: string, ...d: unknown[]) { if (this.enabled(LogLevel.Debug)) console.debug(`[hms] ${m}`, ...d); }
  info(m: string, ...d: unknown[]) { if (this.enabled(LogLevel.Info)) console.info(`[hms] ${m}`, ...d); }
  warn(m: string, ...d: unknown[]) { if (this.enabled(LogLevel.Warn)) console.warn(`[hms] ${m}`, ...d); }
  error(m: string, ...d: unknown[]) { if (this.enabled(LogLevel.Error)) console.error(`[hms] ${m}`, ...d); }
}
/** Production logger (polymorphism: same interface, different minimum level): only warnings and errors, no debug noise. */
export class QuietLogger extends ConsoleLogger {
  protected override readonly minLevel: LogLevel = LogLevel.Warn;
}
export const loggerProvider: Provider = { provide: LOGGER, useClass: environment.production ? QuietLogger : ConsoleLogger };

/* ---------- useExisting + forwardRef: two tokens, one instance ---------- */
export abstract class NotificationChannel {
  abstract push(kind: 'success' | 'error' | 'info' | 'warning', message: string): void;
}
export const notificationChannelProvider = (impl: () => new (...args: never[]) => NotificationChannel): Provider => ({
  provide: NotificationChannel,
  useExisting: forwardRef(impl), // forwardRef: the implementation class is declared later in the file graph
});

/* ---------- Multi providers: features contribute navigation entries ---------- */
export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string; // Material icon name
  readonly group: 'Care' | 'Clinical' | 'Operations' | 'Administration';
  /** Permission required to see the entry (undefined = every signed-in user). */
  readonly permission?: string;
}
export const NAV_ITEMS = new InjectionToken<NavItem[]>('NAV_ITEMS');

/* ---------- providedIn: 'platform': one instance per page (shared by every Angular app on the page) ---------- */
@Injectable({ providedIn: 'platform' })
export class PlatformInfoService {
  readonly instanceId = Math.random().toString(36).slice(2, 8);
  readonly bootedAt = new Date();
}
