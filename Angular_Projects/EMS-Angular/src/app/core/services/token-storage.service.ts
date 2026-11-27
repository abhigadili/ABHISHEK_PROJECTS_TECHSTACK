import { Inject, Injectable } from '@angular/core';
import { SESSION_STORAGE } from '../tokens/tokens';

const REFRESH_KEY = 'ems.refreshToken';

/**
 * The backend returns JWT access + refresh tokens in the JSON body (no HttpOnly cookies), so JavaScript must hold them.
 * Trade-off chosen: the short-lived access token lives only in memory (AuthService), the refresh token in sessionStorage
 * (survives reload, dies with the tab, never shared across tabs, never written to localStorage).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  /** Classic constructor injection with an InjectionToken (the rest of the app uses the inject() function). */
  constructor(@Inject(SESSION_STORAGE) private readonly storage: Storage) {}

  getRefreshToken(): string | null {
    try {
      return this.storage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }

  setRefreshToken(token: string): void {
    try {
      this.storage.setItem(REFRESH_KEY, token);
    } catch {
      /* storage unavailable (private mode): the session simply will not survive a reload */
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  }
}
