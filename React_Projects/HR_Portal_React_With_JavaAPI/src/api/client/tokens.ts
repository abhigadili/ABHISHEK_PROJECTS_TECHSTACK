/**
 * Token handling. The Java auth service returns tokens in the JSON body (no HttpOnly cookie option), so:
 *  - the short-lived access token (30 min) lives only in memory,
 *  - the rotating refresh token lives in sessionStorage (cleared with the tab; never localStorage).
 * XSS is mitigated by never rendering unsanitised HTML (see components/editors/SafeHtml) - see docs/SECURITY.
 */
const RT = 'hr.refreshToken';
let access: string | null = null;
type Listener = () => void;
const logoutListeners = new Set<Listener>();
export const tokens = {
  get access() { return access; },
  set access(v: string | null) { access = v; },
  get refresh(): string | null { try { return sessionStorage.getItem(RT); } catch { return null; } },
  set(a: string | null, r?: string | null) {
    access = a;
    try { if (r === null) sessionStorage.removeItem(RT); else if (r) sessionStorage.setItem(RT, r); } catch { /* storage blocked */ }
  },
  clear() { this.set(null, null); },
  onForcedLogout(fn: Listener) { logoutListeners.add(fn); return () => { logoutListeners.delete(fn); }; },
  forceLogout() { this.clear(); logoutListeners.forEach((f) => f()); },
};
