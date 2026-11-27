import { route, ok } from '@/server/http/api';
import { authService } from '@/server/services/auth.service';
export const POST = route({ public: true }, async () => { await authService.logout(); return ok(null); });
