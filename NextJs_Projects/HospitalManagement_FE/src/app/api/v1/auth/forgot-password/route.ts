import { route, ok, json } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
import { forgotSchema } from '@/lib/validations/auth';
export const POST = route({ public: true }, async (c) => { await authService.forgotPassword(forgotSchema.parse(await json(c.req)).email); return ok({ message: 'If that e-mail is registered, a reset link has been sent.' }); });
