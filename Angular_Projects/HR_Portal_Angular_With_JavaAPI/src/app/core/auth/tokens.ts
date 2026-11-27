/**
 * Token handling. The Java auth service returns tokens in the JSON body (no HttpOnly cookie mode), so the safest compatible approach is:
 *  - the short-lived access token (30 min) lives only in memory,
 *  - the rotating refresh token lives in sessionStorage (cleared with the tab; never localStorage).
 * XSS exposure is reduced by never rendering unsanitised HTML (see shared SafeHtml / DOMPurify).
 */
const RT = 'hr.refreshToken';
let access: string | null = null;
const listeners = new Set<() => void>();
export const tokens = {
  get access() { return access; },
  get refresh(): string | null { try { return sessionStorage.getItem(RT); } catch { return null; } },
  set(a: string | null, r?: string | null) {
    access = a;
    try { if (r === null) sessionStorage.removeItem(RT); else if (r) sessionStorage.setItem(RT, r); } catch { /* storage blocked */ }
  },
  clear() { this.set(null, null); },
  onForcedLogout(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  forceLogout() { this.clear(); listeners.forEach((f) => f()); },
};
