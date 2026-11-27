import { Injectable } from '@angular/core';
import type { TokenResponse } from '../models';

/**
 * Token storage policy: the backend returns BOTH tokens in the JSON body (no HttpOnly cookie), so
 *  - the 15-minute access token lives only in memory,
 *  - the rotating refresh token lives in sessionStorage (tab-scoped, never localStorage).
 * (See API_INTEGRATION_DOCUMENTATION.md – unsupported: HttpOnly refresh cookie.)
 */
@Injectable({ providedIn: 'root' })
export class TokenStoreService {
  private static readonly KEY = 'hms.ng.rt';
  private access: string | null = null;
  private expiresAt = 0;

  get accessToken(): string | null { return this.access; }
  get accessTokenExpiresAt(): number { return this.expiresAt; }
  get refreshToken(): string | null {
    try { return sessionStorage.getItem(TokenStoreService.KEY); } catch { return null; }
  }
  set(t: Pick<TokenResponse, 'accessToken' | 'refreshToken' | 'expiresInSeconds'>): void {
    this.access = t.accessToken;
    this.expiresAt = Date.now() + t.expiresInSeconds * 1000;
    try { sessionStorage.setItem(TokenStoreService.KEY, t.refreshToken); } catch { /* storage blocked */ }
  }
  clear(): void {
    this.access = null;
    this.expiresAt = 0;
    try { sessionStorage.removeItem(TokenStoreService.KEY); } catch { /* ignore */ }
  }
}
