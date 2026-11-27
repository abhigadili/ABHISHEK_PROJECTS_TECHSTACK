import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, Role, UserDto } from '../models';

const KEY = 'fd.session';

/** Session state as signals; tokens persist in localStorage (access token is short-lived, refresh token rotates). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private state = signal<{ access: string; refresh: string; user: UserDto } | null>(this.restore());

  readonly user = computed(() => this.state()?.user ?? null);
  readonly isLoggedIn = computed(() => this.state() !== null);
  readonly roles = computed(() => this.state()?.user.roles ?? []);
  readonly accessToken = () => this.state()?.access ?? null;
  readonly refreshToken = () => this.state()?.refresh ?? null;

  private restore() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  }
  private persist(s: AuthResponse | null) {
    if (!s) { localStorage.removeItem(KEY); this.state.set(null); return; }
    const v = { access: s.accessToken, refresh: s.refreshToken, user: s.user };
    localStorage.setItem(KEY, JSON.stringify(v));
    this.state.set(v);
  }

  hasRole(...r: Role[]): boolean { return this.roles().some(x => r.includes(x as Role)); }
  isAdmin() { return this.hasRole('ADMIN', 'SUPER_ADMIN'); }
  permissions(): string[] {
    try { return JSON.parse(atob((this.accessToken() ?? '..').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).perms ?? []; } catch { return []; }
  }
  can(permission: string) { return this.permissions().includes(permission); }

  /** Where each role lands after login. */
  homeFor(): string {
    if (this.hasRole('ADMIN', 'SUPER_ADMIN')) return '/admin/dashboard';
    if (this.hasRole('RESTAURANT_OWNER', 'RESTAURANT_STAFF')) return '/owner/dashboard';
    if (this.hasRole('DELIVERY_PARTNER')) return '/delivery/dashboard';
    return '/customer/home';
  }

  login(usernameOrEmail: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { usernameOrEmail, password }).pipe(tap(r => this.persist(r)));
  }
  register(body: unknown) { return this.http.post<UserDto>('/api/auth/register', body); }
  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken: this.refreshToken() }).pipe(tap(r => this.persist(r)));
  }
  forgot(email: string) { return this.http.post<{ message: string; devResetToken?: string }>('/api/auth/forgot-password', { email }); }
  reset(token: string, newPassword: string) { return this.http.post<void>('/api/auth/reset-password', { token, newPassword }); }
  changePassword(currentPassword: string, newPassword: string) { return this.http.post<void>('/api/auth/change-password', { currentPassword, newPassword }); }
  logout() {
    const refresh = this.refreshToken();
    const done = () => { this.persist(null); this.router.navigateByUrl('/login'); };
    if (!refresh) return done();
    this.http.post('/api/auth/logout', { refreshToken: refresh }).subscribe({ next: done, error: done });
  }
  expireSession() { this.persist(null); this.router.navigateByUrl('/login'); }
}
