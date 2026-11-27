import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/configuration/env';
import type { RoleKey } from '@/lib/constants/rbac';

/** Claims of the short-lived access token. Verified (signature + exp + issuer/audience) on every protected request. */
export interface AccessClaims { sub: string; role: RoleKey; hid: number | null; pid: number | null; did: number | null; name: string; email: string }
const ISS = 'hms-fe', AUD = 'hms-api';

export async function signAccessToken(c: Omit<AccessClaims, 'sub'> & { userId: number }): Promise<string> {
  const { userId, ...rest } = c;
  return new SignJWT({ ...rest }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId)).setIssuer(ISS).setAudience(AUD).setIssuedAt().setExpirationTime(`${env.accessTtl}s`).sign(env.jwtSecret);
}
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try { const { payload } = await jwtVerify(token, env.jwtSecret, { issuer: ISS, audience: AUD, algorithms: ['HS256'] }); return payload as unknown as AccessClaims; } catch { return null; }
}
/** 5-minute token proving that the password step succeeded and a TOTP code is still required (MFA challenge). */
export async function signMfaChallenge(userId: number) {
  return new SignJWT({ purpose: 'mfa' }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId)).setIssuer(ISS).setAudience('hms-mfa').setExpirationTime('5m').sign(env.jwtSecret);
}
export async function verifyMfaChallenge(token: string): Promise<number | null> {
  try { const { payload } = await jwtVerify(token, env.jwtSecret, { issuer: ISS, audience: 'hms-mfa' }); return payload.purpose === 'mfa' ? Number(payload.sub) : null; } catch { return null; }
}
