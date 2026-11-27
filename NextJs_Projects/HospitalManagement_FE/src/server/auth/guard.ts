import 'server-only';
import { redirect } from 'next/navigation';
import { getPrincipal } from './session';
import type { Principal } from '@/server/authorization/principal';
import type { RoleKey } from '@/lib/constants/rbac';

/** Server-side page guard (the proxy is only a convenience layer): authenticated + one of the allowed roles. */
export async function requireRole(roles: RoleKey[], next?: string): Promise<Principal> {
  const p = await getPrincipal();
  if (!p) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  if (!roles.includes(p.role)) redirect('/access-denied');
  return p;
}
export const requireUser = async (): Promise<Principal> => { const p = await getPrincipal(); if (!p) redirect('/login'); return p; };
