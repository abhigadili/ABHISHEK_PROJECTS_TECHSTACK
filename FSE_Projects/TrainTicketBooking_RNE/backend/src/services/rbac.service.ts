import { prisma } from '../database/prisma';
import type { RoleKey } from '../constants/rbac';
/** role -> permissions comes from MySQL (roles / permissions / role_permissions) and is cached in memory for 30 s. */
const cache = new Map<string, { at: number; perms: Set<string> }>();
export async function permissionsOfRoles(roles: RoleKey[]): Promise<Set<string>> {
  const out = new Set<string>(); const missing: RoleKey[] = [];
  for (const r of roles) { const c = cache.get(r); if (c && Date.now() - c.at < 30_000) c.perms.forEach((p) => out.add(p)); else missing.push(r); }
  if (missing.length) {
    const rows = await prisma.rolePermission.findMany({ where: { role: { key: { in: missing } } }, select: { role: { select: { key: true } }, permission: { select: { key: true } } } });
    for (const r of missing) { const perms = new Set(rows.filter((x) => x.role.key === r).map((x) => x.permission.key)); cache.set(r, { at: Date.now(), perms }); perms.forEach((p) => out.add(p)); }
  }
  return out;
}
export const clearPermissionCache = () => cache.clear();
