/** Access token lives in memory only (never localStorage); the refresh token is an HttpOnly cookie the JS code cannot read. */
let accessToken: string | null = null;
const listeners = new Set<() => void>();
export const tokenStore = {
  get: () => accessToken,
  set(t: string | null) { accessToken = t; listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};
