import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { catchError, exhaustMap, map, of, switchMap, tap } from 'rxjs';
import { AuthApi } from '../../api/services';
import { tokens } from '../../core/auth/tokens';
import { ToastService } from '../../core/services/toast.service';
import { AuthActions } from './auth.state';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly qc = inject(QueryClient);

  /** Login: tokens -> memory / sessionStorage, then /auth/me for the authoritative roles + permissions. */
  login$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.loginRequested),
    exhaustMap(({ username, password }) => this.api.login({ username, password }).pipe(
      tap((tr) => tokens.set(tr.accessToken ?? null, tr.refreshToken ?? null)),
      switchMap((tr) => this.api.me().pipe(catchError(() => of(tr.user!))).pipe(map((user) => AuthActions.loginSucceeded({ user, mustChangePassword: !!tr.mustChangePassword })))),
      catchError((e) => of(AuthActions.loginFailed({ message: e?.message ?? 'Login failed' }))),
    )),
  ));
  loginDone$ = createEffect(() => this.actions$.pipe(ofType(AuthActions.loginSucceeded), tap(({ mustChangePassword, user }) => {
    if (this.router.url.startsWith('/login')) this.toast.success('auth.welcome', { name: user.username ?? '' });
    if (this.router.url.startsWith('/login')) this.router.navigateByUrl(mustChangePassword ? '/change-password' : (this.router.parseUrl(this.router.url).queryParams['returnUrl'] ?? '/'));
  })), { dispatch: false });

  /** App start: if a refresh token survived (same tab) silently resume the session. */
  resume$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.resumeRequested),
    switchMap(() => {
      const rt = tokens.refresh;
      if (!rt) return of(AuthActions.sessionEnded());
      return this.api.refresh({ refreshToken: rt }).pipe(
        tap((tr) => tokens.set(tr.accessToken ?? null, tr.refreshToken ?? null)),
        switchMap((tr) => this.api.me().pipe(map((user) => AuthActions.loginSucceeded({ user, mustChangePassword: !!tr.mustChangePassword })))),
        catchError((e) => { if (!e?.network) tokens.clear(); return of(AuthActions.sessionEnded()); }),
      );
    }),
  ));

  private manual = false;
  logout$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.logoutRequested),
    tap(() => (this.manual = true)),
    exhaustMap(() => this.api.logout({ refreshToken: tokens.refresh ?? undefined }).pipe(catchError(() => of(null)))
      .pipe(map(() => { tokens.clear(); return AuthActions.sessionEnded(); }))),
  ));
  loggedOut$ = createEffect(() => this.actions$.pipe(ofType(AuthActions.sessionEnded, AuthActions.sessionExpired), tap((a) => {
    this.qc.clear();
    if (!/^\/(login|forgot-password|reset-password|register)/.test(this.router.url)) this.router.navigate(['/login']);
    if (a.type === AuthActions.sessionExpired.type) this.toast.warning('auth.sessionExpired'); else if (this.manual) { this.toast.info('auth.loggedOut'); this.manual = false; }
  })), { dispatch: false });
}

