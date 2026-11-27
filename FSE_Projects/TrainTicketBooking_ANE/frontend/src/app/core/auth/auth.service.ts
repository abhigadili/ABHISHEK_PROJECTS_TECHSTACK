import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncSubject, Observable, ReplaySubject, catchError, finalize, firstValueFrom, map, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiClient } from '../services/api-client.service';
import type { PermissionKey, RoleKey, Session, User } from '../models/models';
import { ROLE_PERMISSIONS } from './permissions';

export type SessionEvent = { type: 'login' | 'logout' | 'expired'; user?: User };

/**
 * Authentication state. The backend issues a short-lived bearer access token in the response body and a rotating HttpOnly
 * refresh cookie (path /api/auth). The access token therefore lives only in memory (a signal) - never in web storage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user() && !!this._token());
  readonly roles = computed<RoleKey[]>(() => this._user()?.roles ?? []);
  readonly permissions = computed(() => new Set<PermissionKey>(this.roles().flatMap((r) => ROLE_PERMISSIONS[r] ?? [])));
  /** Anyone with a non-passenger role gets the back-office area. */
  readonly isBackOffice = computed(() => this.roles().some((r) => r !== 'PASSENGER'));
  readonly displayName = computed(() => this._user()?.name ?? '');

  /** Emits once (AsyncSubject) when the start-up session restore has finished. */
  readonly initialized$ = new AsyncSubject<boolean>();
  /** Replays the last login/logout event to late subscribers. */
  readonly events$ = new ReplaySubject<SessionEvent>(1);

  private refreshInFlight$: Observable<Session> | null = null;

  can(...perms: PermissionKey[]) { const have = this.permissions(); return perms.some((p) => have.has(p)); }
  hasRole(...roles: RoleKey[]) { return this.roles().some((r) => roles.includes(r)); }

  /** Called once by the app initializer: try the refresh cookie, never fail the start-up. */
  bootstrap() {
    return firstValueFrom(this.refresh().pipe(catchError(() => of(null)), finalize(() => { this.initialized$.next(true); this.initialized$.complete(); })));
  }

  login(email: string, password: string) {
    return this.api.post<Session>('/auth/login', { email, password }, { public: true, silent: true }).pipe(tap((s) => this.setSession(s, 'login')));
  }
  register(payload: { name: string; email: string; mobile: string; password: string; confirmPassword: string }) {
    return this.api.post<User>('/auth/register', payload, { public: true, silent: true });
  }
  forgotPassword(email: string) { return this.api.post<{ message: string }>('/auth/forgot-password', { email }, { public: true, silent: true }); }
  resetPassword(payload: { token: string; password: string; confirmPassword: string }) { return this.api.post<null>('/auth/reset-password', payload, { public: true, silent: true }); }
  changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) { return this.api.post<null>('/auth/change-password', payload, { silent: true }); }
  loadMe() { return this.api.get<User>('/auth/me').pipe(tap((u) => this._user.set(u))); }
  updateCurrent(u: User) { this._user.set(u); }

  /** Single-flight refresh: concurrent 401s share ONE request (the refresh cookie is single-use). */
  refresh(): Observable<Session> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.api.post<Session>('/auth/refresh', {}, { public: true, silent: true, noLoading: true }).pipe(
        tap((s) => this.setSession(s)),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight$;
  }

  logout(navigate = true) {
    const done = () => { this.clear('logout'); if (navigate) void this.router.navigate(['/auth/login']); };
    return this.api.post<null>('/auth/logout', {}, { public: true, silent: true }).pipe(catchError(() => of(null)), finalize(done), map(() => true));
  }
  /** Drop every trace of the session (called on logout and when a refresh fails). */
  clear(reason: SessionEvent['type'] = 'expired') {
    this._user.set(null); this._token.set(null); this.events$.next({ type: reason });
  }
  private setSession(s: Session, evt?: 'login') { this._user.set(s.user); this._token.set(s.accessToken); if (evt) this.events$.next({ type: evt, user: s.user }); }
  throwUnauthorized() { return throwError(() => new Error('unauthenticated')); }
}
