import 'server-only';
import { redirect } from 'next/navigation';
import { can, type Permission } from '@/constants/roles';
import { requireSession, type SessionUser } from './session';

/** Page/layout guard: unauthenticated → /login, authenticated but not allowed → /unauthorized. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const s = await requireSession();
  if (!can(s.role, permission)) redirect('/unauthorized');
  return s;
}

/** Server Action / Route Handler guard: returns a result instead of redirecting so the caller can answer 401/403 or form state. */
export async function checkPermission(permission?: Permission): Promise<{ ok: true; user: SessionUser } | { ok: false; status: 401 | 403; message: string }> {
  const { getSession } = await import('./session');
  const s = await getSession();
  if (!s) return { ok: false, status: 401, message: 'You are not signed in' };
  if (permission && !can(s.role, permission)) return { ok: false, status: 403, message: 'You do not have permission to do that' };
  return { ok: true, user: s };
}
