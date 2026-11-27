import { route, ok, json } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
import { resetSchema } from '@/lib/validations/auth';
export const POST = route({ public: true }, async (c) => { const d = resetSchema.parse(await json(c.req)); await authService.resetPassword(d.token, d.password); return ok(null); });
