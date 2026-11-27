import { route, ok, json } from '@/server/http/api';
import { mfaService } from '@/server/auth/mfa';
import { mfaVerifySchema } from '@/lib/validations/auth';
/** POST confirms enrolment with a first TOTP code and returns the one-time recovery codes. */
export const POST = route({}, async (c) => ok({ recoveryCodes: await mfaService.confirmEnrollment(c.principal.userId, mfaVerifySchema.parse(await json(c.req)).code) }));
