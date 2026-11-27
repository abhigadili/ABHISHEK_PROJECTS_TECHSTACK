import 'server-only';
import { db } from '@/server/db';
import { forbidden } from '@/server/utilities/errors';
import type { PermissionKey, RoleKey } from '@/lib/constants/rbac';
import type { Principal } from './principal';

/** Role → permissions is stored in MySQL (Role/Permission/RolePermission) and cached in memory for 30 s (invalidated when Super Admin edits it). */
const cache = new Map<string, { at: number; perms: Set<string> }>();
const TTL = 30_000;

export async function permissionsOf(role: RoleKey): Promise<Set<string>> {
  const hit = cache.get(role);
  if (hit && Date.now() - hit.at < TTL) return hit.perms;
  const rows = await db.rolePermission.findMany({ where: { role: { key: role } }, select: { permission: { select: { key: true } } } });
  const perms = new Set(rows.map((r) => r.permission.key));
  cache.set(role, { at: Date.now(), perms });
  return perms;
}
export const invalidatePermissionCache = () => cache.clear();
export const can = async (p: Principal, perm: PermissionKey) => (await permissionsOf(p.role)).has(perm);
export async function assertCan(p: Principal, perm: PermissionKey): Promise<void> { if (!(await can(p, perm))) throw forbidden(); }
