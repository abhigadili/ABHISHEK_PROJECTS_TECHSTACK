import type { UserResponse } from '../../api/types/auth';

/**
 * Client-side mirror of the backend's @PreAuthorize rules - ONLY to hide UI the user cannot use.
 * The backend remains the sole authority (frontend permissions are never a security boundary).
 * Supports hasRole / hasAnyRole / hasAuthority / hasAnyAuthority joined with `or` / `and`; anything it cannot evaluate
 * (ownership beans such as @authz.isSelfOrHr) is treated as "allowed" - the backend decides and answers 403 if needed.
 */
export interface Principal { roles: string[]; permissions: string[] }
export const principalOf = (u?: UserResponse | null): Principal => ({ roles: (u?.roles ?? []).map((r) => r.replace(/^ROLE_/, '')), permissions: u?.permissions ?? [] });
export const hasRole = (p: Principal, ...r: string[]) => p.roles.includes('SUPER_ADMIN') || r.some((x) => p.roles.includes(x));
export const hasPerm = (p: Principal, ...c: string[]) => p.roles.includes('SUPER_ADMIN') || c.some((x) => p.permissions.includes(x) || p.permissions.includes(x.replace(/^PERM_/, '')) || p.permissions.includes('PERM_' + x));

const args = (s: string) => [...s.matchAll(/'([^']*)'/g)].map((m) => m[1]);
function evalTerm(t: string, p: Principal): boolean {
  const term = t.trim().replace(/^\(+|\)+$/g, '');
  if (/^has(Any)?Role\(/.test(term)) return hasRole(p, ...args(term));
  if (/^has(Any)?Authority\(/.test(term)) return hasPerm(p, ...args(term));
  return true;
}
export function evalAuthorize(expr: string | null | undefined, p: Principal): boolean {
  if (!expr) return true;
  return expr.split(/\s+or\s+/).some((orPart) => orPart.split(/\s+and\s+/).every((t) => evalTerm(t, p)));
}
