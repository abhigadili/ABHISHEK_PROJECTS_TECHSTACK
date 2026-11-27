import { APP_INITIALIZER, ApplicationConfig, inject, provideZoneChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore, Store } from '@ngrx/store';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { providePrimeNG } from 'primeng/config';
import { provideEchartsCore } from 'ngx-echarts';
import { provideToastr } from 'ngx-toastr';
import { firstValueFrom, filter } from 'rxjs';
import { routes } from './app.routes';
import { tokens } from './core/auth/tokens';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';
import { ApiError } from './core/models/api-error';
import { AuthEffects } from './state/ngrx/auth.effects';
import { AuthActions, authFeature, selectStatus } from './state/ngrx/auth.state';
import { recentFeature } from './state/ngrx/recent.state';
import { HrPreset } from './core/config/primeng-preset';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: (n, e) => !(e instanceof ApiError && (e.network || (e.status >= 400 && e.status < 500))) && n < 1 } },
});

/** Start-up: language first (so the very first paint is translated), theme, then silently resume a session from the refresh token. */
function bootstrap() {
  const store = inject(Store); const lang = inject(LanguageService); inject(ThemeService);
  return async () => {
    tokens.onForcedLogout(() => store.dispatch(AuthActions.sessionExpired()));
    await lang.init();
    store.dispatch(AuthActions.resumeRequested());
    await firstValueFrom(store.select(selectStatus).pipe(filter((s) => s !== 'unknown')));
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideStore(), provideState(authFeature), provideState(recentFeature), provideEffects(AuthEffects),
    provideTranslateService({ defaultLanguage: 'en', loader: { provide: TranslateLoader, useFactory: (http: HttpClient) => new TranslateHttpLoader(http, '/assets/i18n/', '.json'), deps: [HttpClient] } }),
    provideTanStackQuery(queryClient),
    providePrimeNG({ theme: { preset: HrPreset, options: { darkModeSelector: '[data-theme="dark"]', cssLayer: false } } }),
    provideEchartsCore({ echarts: () => import('echarts') }),
    provideToastr({ positionClass: 'toast-top-right', timeOut: 4000, progressBar: true, preventDuplicates: true, countDuplicates: false, closeButton: true, maxOpened: 4 }),
    { provide: APP_INITIALIZER, multi: true, useFactory: bootstrap },
  ],
};
