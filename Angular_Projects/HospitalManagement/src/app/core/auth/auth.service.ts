import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { API_PREFIX } from '../configuration/app-config';
import { SKIP_AUTH, SILENT_ERRORS } from '../interceptors/http-context';
import type { LoginRequest, RegisterAccountRequest, TokenResponse, UserAccount, Role } from '../models';
import { can, type Permission } from './permissions';
import { TokenStoreService } from './token-store.service';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';
export type LogoutReason = 'logout' | 'expired' | 'idle';

/**
 * Authentication service (Signals + RxJS).
 *  - state is Signal-based: `user`, `status`, derived `role`, `isAuthenticated`
 *  - `user$` = toObservable(user) is the RxJS view of the same state
 *  - single-flight token refresh: concurrent 401s share ONE refresh request (`refresh$` + shareReplay) because the
 *    backend rotates refresh tokens and revokes the whole family if an old one is replayed.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly prefix = inject(API_PREFIX);
  private readonly tokens = inject(TokenStoreService);

  private readonly _user = signal<UserAccount | null>(null);
  private readonly _status = signal<AuthStatus>('loading');
  private readonly _logoutReason = signal<LogoutReason | null>(null);

  /** Readonly signals (asReadonly) – only this service can change them. */
  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly logoutReason = this._logoutReason.asReadonly();
  readonly role = computed<Role | undefined>(() => this._user()?.role);
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');
  readonly user$ = toObservable(this._user);

  /** Subject-based communication: emits when the session ends so other services can clean up. */
  private readonly sessionEnded = new Subject<LogoutReason>();
  readonly sessionEnded$ = this.sessionEnded.asObservable();

  private inflightRefresh$: Observable<TokenResponse> | null = null;
  private readonly authCtx = () => new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true);

  login(body: LoginRequest): Observable<UserAccount> {
    return this.http.post<TokenResponse>(`${this.prefix}/auth/login`, body, { context: new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true) }).pipe(
      tap((t) => this.adopt(t)),
      map((t) => t.user),
    );
  }

  register(body: RegisterAccountRequest): Observable<UserAccount> {
    return this.http.post<UserAccount>(`${this.prefix}/auth/register`, body, { context: new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true) });
  }

  /** Single-flight refresh (RxJS: defer-like inflight tracking, shareReplay, finalize). */
  refresh(): Observable<TokenResponse> {
    if (this.inflightRefresh$) return this.inflightRefresh$;
    const refreshToken = this.tokens.refreshToken;
    if (!refreshToken) return throwError(() => new Error('No refresh token'));
    this.inflightRefresh$ = this.http.post<TokenResponse>(`${this.prefix}/auth/refresh`, { refreshToken }, { context: this.authCtx() }).pipe(
      tap((t) => this.adopt(t)),
      catchError((e) => {
        this.endSession('expired');
        return throwError(() => e);
      }),
      finalize(() => (this.inflightRefresh$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inflightRefresh$;
  }

  /** Used by provideAppInitializer(): restore a session after a page reload (never errors). */
  restoreSession(): Observable<boolean> {
    if (!this.tokens.refreshToken) {
      this._status.set('anonymous');
      return of(false);
    }
    return this.refresh().pipe(
      map(() => true),
      catchError(() => {
        this._status.set('anonymous');
        return of(false);
      }),
    );
  }

  logout(reason: LogoutReason = 'logout'): Observable<void> {
    const rt = this.tokens.refreshToken;
    this.endSession(reason);
    if (!rt) return EMPTY;
    return this.http.post<void>(`${this.prefix}/auth/logout`, { refreshToken: rt }, { context: this.authCtx() }).pipe(
      catchError(() => EMPTY), // best effort – the local session is already gone
    );
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }
  can(permission: Permission | string): boolean {
    return can(this.role(), permission);
  }

  /** Proactive renewal: ms until one minute before the access token expires. */
  msUntilRenewal(): number {
    return Math.max(this.tokens.accessTokenExpiresAt - Date.now() - 60_000, 5_000);
  }

  private adopt(t: TokenResponse): void {
    this.tokens.set(t);
    this._user.set(t.user);
    this._status.set('authenticated');
    this._logoutReason.set(null);
  }

  private endSession(reason: LogoutReason): void {
    const wasAuth = this._status() === 'authenticated';
    this.tokens.clear();
    this._user.set(null);
    this._status.set('anonymous');
    this._logoutReason.set(reason);
    if (wasAuth) this.sessionEnded.next(reason);
  }
}
