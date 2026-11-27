import { route, ok, json } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
import { mfaVerifySchema } from '@/lib/validations/auth';
export const POST = route({ public: true }, async (c) => ok(await authService.completeMfa(mfaVerifySchema.parse(await json(c.req)).code)));
