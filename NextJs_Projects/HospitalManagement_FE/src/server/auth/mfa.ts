import 'server-only';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import { decryptSecret, encryptSecret, randomCode } from '@/server/utilities/crypto';
import { env } from '@/lib/configuration/env';
import { badRequest } from '@/server/utilities/errors';

authenticator.options = { window: 1 }; // accept +/- 30 s clock drift

export const mfaService = {
  /** Step 1 of enrolment: create (not yet enabled) secret and return an otpauth URI + QR code. */
  async beginEnrollment(userId: number, email: string) {
    const secret = authenticator.generateSecret();
    await db.mfaConfiguration.upsert({ where: { userId }, create: { userId, secretEnc: encryptSecret(secret), recoveryCodes: [], enabled: false }, update: { secretEnc: encryptSecret(secret), enabled: false, recoveryCodes: [], verifiedAt: null } });
    const uri = authenticator.keyuri(email, env.appName, secret);
    return { secret, uri, qrDataUrl: await QRCode.toDataURL(uri) };
  },
  /** Step 2: prove the authenticator works, enable MFA and return one-time recovery codes (shown once, stored hashed). */
  async confirmEnrollment(userId: number, code: string) {
    const cfg = await db.mfaConfiguration.findUnique({ where: { userId } });
    if (!cfg) throw badRequest('Start enrolment first');
    if (!authenticator.check(code, decryptSecret(cfg.secretEnc))) throw badRequest('That code is not valid', { code: 'Invalid code' });
    const codes = Array.from({ length: 8 }, () => `${randomCode(5)}-${randomCode(5)}`);
    await db.mfaConfiguration.update({ where: { userId }, data: { enabled: true, verifiedAt: new Date(), recoveryCodes: await Promise.all(codes.map((c) => bcrypt.hash(c, 10))) } });
    return codes;
  },
  async disable(userId: number) { await db.mfaConfiguration.deleteMany({ where: { userId } }); },
  async isEnabled(userId: number) { return !!(await db.mfaConfiguration.findFirst({ where: { userId, enabled: true } })); },
  /** Accepts a TOTP code or a (single-use) recovery code. */
  async verify(userId: number, input: string): Promise<boolean> {
    const cfg = await db.mfaConfiguration.findFirst({ where: { userId, enabled: true } });
    if (!cfg) return false;
    const v = input.replace(/\s/g, '');
    if (/^\d{6}$/.test(v)) return authenticator.check(v, decryptSecret(cfg.secretEnc));
    const hashes = cfg.recoveryCodes as string[];
    for (let i = 0; i < hashes.length; i++) if (await bcrypt.compare(v.toUpperCase(), hashes[i])) { await db.mfaConfiguration.update({ where: { userId }, data: { recoveryCodes: hashes.filter((_, j) => j !== i) } }); return true; }
    return false;
  },
};
