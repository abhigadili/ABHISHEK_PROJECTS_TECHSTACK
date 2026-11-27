import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading, withRouterConfig } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import {
  authInterceptor,
  correlationIdInterceptor,
  errorInterceptor,
  loadingInterceptor,
  refreshInterceptor,
} from './core/interceptors/interceptors';
import { SelectivePreloadingStrategy } from './core/preloading';
import { AuthService } from './core/services/auth.service';
import { AppTitleStrategy } from './core/title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(), // route params/data/query params arrive as component inputs where convenient
      withPreloading(SelectivePreloadingStrategy),
      withRouterConfig({ paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    // Order matters on the way out; responses flow back in reverse: refresh sees raw 401s first, error normalises last.
    provideHttpClient(withInterceptors([correlationIdInterceptor, loadingInterceptor, errorInterceptor, authInterceptor, refreshInterceptor])),
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    // Kick off session restore (refresh-token → new access token) at startup without blocking first paint;
    // guards await AuthService.sessionReady$ so a reload on a protected page doesn't flash /login.
    provideAppInitializer(() => {
      inject(AuthService).restoreSession();
    }),
  ],
};
