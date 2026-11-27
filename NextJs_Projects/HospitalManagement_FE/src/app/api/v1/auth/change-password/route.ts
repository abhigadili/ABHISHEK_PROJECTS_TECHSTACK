import { route, ok, json } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
import { changePasswordSchema } from '@/lib/validations/auth';
export const POST = route({}, async (c) => { const d = changePasswordSchema.parse(await json(c.req)); await authService.changePassword(c.principal.userId, d.currentPassword, d.newPassword); return ok(null); });
