import { forbidden, notFound } from './errors';
import { queryOne } from './db';
import type { AuthUser } from '../middleware/auth';

/** Who may act on a given user record: self, or staff according to the target's role. */
export async function assertCanManageUser(actor: AuthUser, targetId: number, opts: { selfOnly?: boolean } = {}) {
  const target = await queryOne<{ id: number; role: string }>(
    'SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [targetId]);
  if (!target) throw notFound('User');
  if (actor.id === targetId) return target;
  if (opts.selfOnly) throw forbidden();
  if (actor.role === 'admin') return target;
  if (actor.role === 'librarian' && target.role === 'member') return target;
  throw forbidden();
}

/** Members may only see their own data; staff may see any member's. */
export function assertSelfOrStaff(actor: AuthUser, targetId: number) {
  if (actor.id !== targetId && actor.role === 'member') throw forbidden();
}
