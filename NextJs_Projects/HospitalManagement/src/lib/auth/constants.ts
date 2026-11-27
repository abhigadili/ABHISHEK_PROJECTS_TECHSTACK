/** Cookie names + timings shared by the proxy, route handlers and server-only session helpers. */
export const AT_COOKIE = 'hms_at'; // access token  (HttpOnly)
export const RT_COOKIE = 'hms_rt'; // refresh token (HttpOnly)
export const ROLE_COOKIE = 'hms_role'; // NON-sensitive routing hint (readable by client UI, never trusted for security)
export const RT_MAX_AGE = 7 * 24 * 3600;
/** Refresh the access token silently when fewer seconds than this remain. */
export const REFRESH_SKEW_SECONDS = 60;
