import { route, ok } from '@/server/http/api';
import { mfaService } from '@/server/auth/mfa';
/** POST begins TOTP enrolment (returns QR + secret). DELETE disables MFA. */
export const POST = route({}, async (c) => ok(await mfaService.beginEnrollment(c.principal.userId, c.principal.email)));
export const DELETE = route({}, async (c) => { await mfaService.disable(c.principal.userId); return ok(null); });
