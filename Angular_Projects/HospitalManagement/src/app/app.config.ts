import { CurrencyPipe, DatePipe } from '@angular/common';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideExperimentalZonelessChangeDetection, provideZoneChangeDetection } from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling, withNavigationErrorHandler, withPreloading, withRouterConfig } from '@angular/router';
import Aura from '@primeng/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { AuthService } from './core/auth/auth.service';
import { PlatformInfoService, loggerProvider, notificationChannelProvider } from './core/configuration/app-config';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { CorrelationIdInterceptor } from './core/interceptors/correlation-id.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { retryInterceptor } from './core/interceptors/retry.interceptor';
import { AppErrorHandler } from './core/services/app-error-handler';
import { LoggingService } from './core/services/logging.service';
import { NotificationService } from './core/services/notification.service';
import { ListReuseStrategy, SelectivePreloadingStrategy } from './core/services/routing-strategies';
import { SessionManagerService } from './core/services/session-manager.service';
import { ThemeService } from './core/services/theme.service';
import { routes } from './app.routes';
import { provideAppState } from './state';
import { NAV_PROVIDERS } from './layouts/nav-items';

/**
 * Application configuration (standalone bootstrap – no AppModule). Everything is a functional provider:
 *  change detection (zoneless by default, flag in environment), router features, HttpClient + interceptor chain,
 *  NgRx root store, UI-library providers, DI tokens and application initialisers.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // ---- change detection: zoneless (signals/OnPush driven) or classic zone.js
    environment.zoneless ? provideExperimentalZonelessChangeDetection() : provideZoneChangeDetection({ eventCoalescing: true }),

    // ---- router
    provideRouter(
      routes,
      withComponentInputBinding(), // route params / query params / resolved data → component @Input / input()
      withPreloading(SelectivePreloadingStrategy), // custom preloading strategy
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload' }),
      withNavigationErrorHandler((e) => console.error('[router] navigation error', e.error)),
    ),
    { provide: RouteReuseStrategy, useClass: ListReuseStrategy }, // custom route reuse strategy

    // ---- HttpClient: ORDER MATTERS. Request flows top → bottom, response bottom → top.
    //   loading (outermost: counts every request) → logging → error (maps HttpErrorResponse → ApiError after retries) →
    //   retry (idempotent GETs) → auth (Bearer + 401 refresh/replay, closest to the network). Class-based interceptors come last.
    provideHttpClient(withInterceptors([loadingInterceptor, loggingInterceptor, errorInterceptor, retryInterceptor, authInterceptor]), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: CorrelationIdInterceptor, multi: true },

    // ---- NgRx root store, router store, devtools
    provideAppState(),

    // ---- UI libraries
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark', cssLayer: false } }, ripple: true }),

    // ---- dependency-injection providers
    loggerProvider, // useClass (console vs quiet logger)
    { provide: ErrorHandler, useClass: AppErrorHandler },
    notificationChannelProvider(() => NotificationService), // useExisting + forwardRef
    ...NAV_PROVIDERS, // multi providers: every feature contributes its navigation entry
    DatePipe,
    CurrencyPipe,

    // ---- application initialisers: restore the session BEFORE the first navigation (guards then see the right state)
    provideAppInitializer(() => {
      inject(PlatformInfoService);
      inject(ThemeService);
      inject(LoggingService).info('bootstrapping HospitalManagement');
      return inject(AuthService).restoreSession();
    }),
    provideAppInitializer(() => void inject(SessionManagerService)),
  ],
};
