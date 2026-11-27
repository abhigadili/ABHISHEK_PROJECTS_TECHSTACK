/** Cookie names shared by the proxy, route handlers and server actions. */
export const AT_COOKIE = 'hms_at'; // access JWT (HttpOnly)
export const RT_COOKIE = 'hms_rt'; // opaque refresh token (HttpOnly, rotating)
export const MFA_COOKIE = 'hms_mfa'; // MFA challenge token (HttpOnly, 5 min)
export const ROLE_COOKIE = 'hms_role'; // non-sensitive routing hint for the proxy / UI (never trusted)
export const OAUTH_STATE_COOKIE = 'hms_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'hms_oauth_verifier';
