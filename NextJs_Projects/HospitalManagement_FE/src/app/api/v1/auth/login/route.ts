import { route, ok, json } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
import { loginSchema } from '@/lib/validations/auth';
/** POST /api/v1/auth/login -> { status: 'ok', home } or { status: 'mfa' } (a TOTP challenge is required next). */
export const POST = route({ public: true }, async (c) => { const d = loginSchema.parse(await json(c.req)); return ok(await authService.login(d.email, d.password)); });
