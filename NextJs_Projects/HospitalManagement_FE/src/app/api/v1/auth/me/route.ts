import { route, ok } from '@/server/http/api';
import { db } from '@/server/db';
import { permissionsOf } from '@/server/authorization/rbac';
/** GET /api/v1/auth/me - the verified caller with their effective permissions. */
export const GET = route({}, async (c) => {
  const u = await db.user.findUniqueOrThrow({ where: { id: c.principal.userId }, select: { id: true, email: true, firstName: true, lastName: true, mfa: { select: { enabled: true } }, oauthAccounts: { select: { provider: true, email: true } } } });
  return ok({ ...u, role: c.principal.role, hospitalId: c.principal.hospitalId, permissions: [...(await permissionsOf(c.principal.role))] });
});
