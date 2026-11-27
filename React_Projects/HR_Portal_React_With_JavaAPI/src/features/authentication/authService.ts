import { authApi } from '@/api/services/authApi';
import { tokens } from '@/api/client/tokens';
import { store } from '@/store/redux';
import { sessionStarted, sessionEnded } from '@/store/redux/authSlice';

/** Login flow: tokens -> memory/sessionStorage, then /auth/me for the authoritative roles + permissions. */
export async function performLogin(username: string, password: string) {
  const tr = await authApi.login({ username, password });
  tokens.set(tr.accessToken ?? null, tr.refreshToken ?? null);
  let user = tr.user;
  try { user = await authApi.me(); } catch { /* must-change-password sessions may only call change-password */ }
  store.dispatch(sessionStarted({ user: user!, mustChangePassword: tr.mustChangePassword }));
  return tr;
}
/** Called on app start: if a refresh token survived (same tab), silently resume the session. */
export async function resumeSession() {
  const rt = tokens.refresh;
  if (!rt) { store.dispatch(sessionEnded()); return; }
  try {
    const tr = await authApi.refresh({ refreshToken: rt });
    tokens.set(tr.accessToken ?? null, tr.refreshToken ?? null);
    const user = await authApi.me();
    store.dispatch(sessionStarted({ user, mustChangePassword: tr.mustChangePassword }));
  } catch (e: any) {
    if (e?.network) { store.dispatch(sessionEnded()); return; } // keep refresh token: backend may just be down
    tokens.clear(); store.dispatch(sessionEnded());
  }
}
export async function performLogout() {
  const rt = tokens.refresh;
  try { await authApi.logout({ refreshToken: rt ?? undefined }); } catch { /* token may already be invalid */ }
  tokens.clear(); store.dispatch(sessionEnded());
}
/** After a password change the backend has already revoked every session/token, so just forget them locally (no API call, no refresh attempt). */
export function endSessionLocally() { tokens.clear(); store.dispatch(sessionEnded()); }
