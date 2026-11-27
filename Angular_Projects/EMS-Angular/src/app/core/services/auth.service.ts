import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AsyncSubject,
  Observable,
  ReplaySubject,
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import {
  ChangePasswordRequest,
  CurrentUser,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RegistrationOptions,
  RegistrationResult,
  Role,
  SessionUser,
  TokenPair,
} from '../models/auth.models';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';

export type AuthEvent = { type: 'login' | 'logout' | 'refresh' | 'session-expired'; at: number };

/**
 * Authentication state + token lifecycle.
 *  - Signals hold UI state (user, role, isAuthenticated…) — synchronous, template friendly.
 *  - RxJS coordinates the asynchronous parts: login/refresh/logout calls, the single shared refresh request,
 *    the AsyncSubject that tells guards "session restore finished", and a ReplaySubject auth-event stream.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);
  private readonly router = inject(Router);

  private accessToken: string | null = null;

  private readonly _user = signal<SessionUser | null>(null);
  private readonly _profile = signal<CurrentUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);
  readonly employeeId = computed(() => this._user()?.employeeId ?? null);
  readonly displayName = computed(() => {
    const emp = this._profile()?.employee;
    return emp ? `${emp.firstName} ${emp.lastName}` : (this._user()?.email ?? '');
  });

  /** AsyncSubject: emits once, on completion, when the startup session restore has finished. Guards wait for it. */
  readonly sessionReady$ = new AsyncSubject<boolean>();

  /** ReplaySubject(3): late subscribers (e.g. the shell) still see the most recent auth events. */
  private readonly eventsSubject = new ReplaySubject<AuthEvent>(3);
  readonly events$ = this.eventsSubject.asObservable();

  private refreshInFlight$: Observable<string> | null = null;
  private restoreStarted = false;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  login(credentials: LoginRequest): Observable<SessionUser> {
    return this.api
      .post<LoginResponse>('/auth/login', credentials, { skipAuth: true, skipRefresh: true, skipErrorToast: true })
      .pipe(
        tap((res) => this.startSession(res)),
        switchMap((res) => this.loadProfile().pipe(map(() => res.user), catchError(() => of(res.user)))),
        tap(() => this.emit('login')),
      );
  }

  /** Public self-registration (multipart; the optional picture travels in the `file` field). confirmPassword is never sent. */
  register(form: FormData): Observable<RegistrationResult> {
    return this.api.post<RegistrationResult>('/auth/register', form, { skipAuth: true, skipRefresh: true, skipErrorToast: true });
  }

  registrationOptions(): Observable<RegistrationOptions> {
    return this.api.get<RegistrationOptions>('/auth/registration-options', undefined, { skipAuth: true, skipRefresh: true, skipErrorToast: true, retry: false });
  }

  /** true when nobody owns the username yet. */
  usernameAvailable(username: string): Observable<boolean> {
    return this.api
      .get<{ available: boolean }>('/auth/username-available', { username }, { skipAuth: true, skipRefresh: true, skipErrorToast: true, skipLoading: true, retry: false })
      .pipe(map((r) => r.available));
  }

  /** Called once at startup: if a refresh token survived a reload, trade it for a fresh session. */
  restoreSession(): Observable<boolean> {
    if (this.restoreStarted) return this.sessionReady$;
    this.restoreStarted = true;
    const stored = this.tokens.getRefreshToken();
    if (!stored) {
      this.finishRestore(false);
      return this.sessionReady$;
    }
    this.refreshAccessToken()
      .pipe(
        switchMap(() => this.api.get<CurrentUser>('/auth/me', undefined, { skipRefresh: true, skipErrorToast: true })),
        tap((me) => {
          this._profile.set(me);
          this._user.set({ id: me.id, username: me.username ?? null, email: me.email, role: me.role, employeeId: me.employee?.id ?? null });
        }),
      )
      .subscribe({
        next: () => this.finishRestore(true),
        error: () => {
          this.clearSession();
          this.finishRestore(false);
        },
      });
    return this.sessionReady$;
  }

  /**
   * One refresh request shared by every concurrent 401 (the backend rotates refresh tokens and treats reuse as theft,
   * so firing two refreshes with the same token would revoke the whole session family).
   */
  refreshAccessToken(): Observable<string> {
    if (!this.refreshInFlight$) {
      const refreshToken = this.tokens.getRefreshToken();
      if (!refreshToken) return throwError(() => new Error('No refresh token'));
      this.refreshInFlight$ = defer(() =>
        this.api.post<TokenPair>('/auth/refresh', { refreshToken }, { skipAuth: true, skipRefresh: true, skipErrorToast: true }),
      ).pipe(
        tap((pair) => {
          this.accessToken = pair.accessToken;
          this.tokens.setRefreshToken(pair.refreshToken);
          this.emit('refresh');
        }),
        map((pair) => pair.accessToken),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight$;
  }

  logout(redirect = true): void {
    const refreshToken = this.tokens.getRefreshToken();
    if (refreshToken) {
      // Best effort: revoke server-side; local cleanup never depends on the network.
      this.api
        .post('/auth/logout', { refreshToken }, { skipRefresh: true, skipErrorToast: true, skipLoading: true })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    this.emit('logout');
    if (redirect) void this.router.navigate(['/login']);
  }

  /** Used by the refresh interceptor when the session cannot be recovered. */
  expireSession(returnUrl?: string): void {
    this.clearSession();
    this.emit('session-expired');
    void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse | null> {
    return this.api.post<ForgotPasswordResponse | null>('/auth/forgot-password', { email }, { skipAuth: true, skipErrorToast: true });
  }

  resetPassword(token: string, newPassword: string): Observable<null> {
    return this.api.post<null>('/auth/reset-password', { token, newPassword }, { skipAuth: true, skipErrorToast: true });
  }

  /** Backend revokes every session on password change, so the caller must log the user out afterwards. */
  changePassword(body: ChangePasswordRequest): Observable<null> {
    return this.api.post<null>('/auth/change-password', body, { skipErrorToast: true });
  }

  loadProfile(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>('/auth/me').pipe(tap((me) => this._profile.set(me)));
  }

  private startSession(res: LoginResponse): void {
    this.accessToken = res.accessToken;
    this.tokens.setRefreshToken(res.refreshToken);
    this._user.set(res.user);
  }

  private clearSession(): void {
    this.accessToken = null;
    this.tokens.clear();
    this._user.set(null);
    this._profile.set(null);
  }

  private finishRestore(ok: boolean): void {
    this.sessionReady$.next(ok);
    this.sessionReady$.complete();
  }

  private emit(type: AuthEvent['type']): void {
    this.eventsSubject.next({ type, at: Date.now() });
  }
}
