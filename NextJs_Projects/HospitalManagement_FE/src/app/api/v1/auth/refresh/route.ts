import { route, ok } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
/** POST /api/v1/auth/refresh - rotates the refresh token (cookie) and issues a new access token. Also called by proxy.ts. */
export const POST = route({ public: true }, async () => { await authService.refresh(); return ok(null); });
