import { ApplicationConfig, isDevMode, provideAppInitializer, inject, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withNavigationErrorHandler, withPreloading, PreloadAllModules, withRouterConfig, withViewTransitions } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { ToastService } from './core/services/toast.service';
import { NotificationEffects, notificationsFeature } from './store/notifications/notifications.store';
import { bookingFlowFeature } from './store/booking-flow/booking-flow.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withPreloading(PreloadAllModules),
      withViewTransitions(),
      withNavigationErrorHandler((e) => { inject(ToastService).error('That page could not be loaded.'); console.error(e.error); }),
    ),
    // interceptor order: logging -> loading -> auth (token + refresh) -> error mapping (closest to the wire)
    provideHttpClient(withFetch(), withInterceptors([loggingInterceptor, loadingInterceptor, authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { horizontalPosition: 'center', verticalPosition: 'bottom' } },
    provideStore({ [notificationsFeature.name]: notificationsFeature.reducer, [bookingFlowFeature.name]: bookingFlowFeature.reducer }),
    provideEffects(NotificationEffects),
    provideStoreDevtools({ maxAge: 30, logOnly: !isDevMode(), connectInZone: true }),
    // restore the session (refresh cookie) BEFORE the first route is evaluated, so guards see the real auth state
    provideAppInitializer(() => inject(AuthService).bootstrap()),
  ],
};
