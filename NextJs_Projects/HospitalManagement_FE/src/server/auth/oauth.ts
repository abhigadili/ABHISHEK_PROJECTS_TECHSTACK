import 'server-only';
import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { env, oauthGoogleEnabled } from '@/lib/configuration/env';
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '@/lib/constants/auth';
import { badRequest } from '@/server/utilities/errors';
import { nextMrn } from '@/server/utilities/ids';

/**
 * OAuth 2.0 authorization-code flow with PKCE + state (Google / OpenID Connect) using the `arctic` client library.
 * The provider is configured only through environment variables; without them the feature reports itself as disabled.
 */
const client = () => { if (!oauthGoogleEnabled()) throw badRequest('Google sign-in is not configured on this server'); return new Google(env.google.id, env.google.secret, env.google.redirect); };

export async function beginGoogleLogin(): Promise<URL> {
  const state = generateState(), verifier = generateCodeVerifier();
  const jar = await cookies();
  const o = { httpOnly: true, sameSite: 'lax' as const, secure: env.cookieSecure, path: '/', maxAge: 600 };
  jar.set(OAUTH_STATE_COOKIE, state, o); jar.set(OAUTH_VERIFIER_COOKIE, verifier, o);
  return client().createAuthorizationURL(state, verifier, ['openid', 'profile', 'email']);
}

interface IdClaims { sub: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string; name?: string }
/** Validates state, exchanges the code (PKCE verifier), then links/creates the local user. Returns the user id. */
export async function completeGoogleLogin(code: string, state: string, linkUserId?: number): Promise<number> {
  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value, verifier = jar.get(OAUTH_VERIFIER_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE); jar.delete(OAUTH_VERIFIER_COOKIE);
  if (!expected || !verifier || expected !== state) throw badRequest('OAuth state mismatch');
  const tokens = await client().validateAuthorizationCode(code, verifier);
  const c = decodeIdToken(tokens.idToken()) as IdClaims;
  if (!c.email || c.email_verified === false) throw badRequest('Your Google account has no verified e-mail address');
  const email = c.email.toLowerCase();

  const existing = await db.oAuthAccount.findUnique({ where: { provider_providerUserId: { provider: 'google', providerUserId: c.sub } } });
  if (existing) return existing.userId;
  if (linkUserId) { await db.oAuthAccount.create({ data: { userId: linkUserId, provider: 'google', providerUserId: c.sub, email } }); return linkUserId; } // account LINKING from the profile page
  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) { if (byEmail.status !== 'ACTIVE' || byEmail.deletedAt) throw badRequest('This account is not active'); await db.oAuthAccount.create({ data: { userId: byEmail.id, provider: 'google', providerUserId: c.sub, email } }); return byEmail.id; }
  // first OAuth sign-in: create a PATIENT account (profile completed later)
  const role = await db.role.findUniqueOrThrow({ where: { key: 'PATIENT' } });
  const u = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, firstName: c.given_name ?? c.name ?? 'Google', lastName: c.family_name ?? 'User', roleId: role.id, emailVerifiedAt: new Date() } });
    await tx.patient.create({ data: { userId: user.id, mrn: await nextMrn(tx), dateOfBirth: new Date('1990-01-01'), gender: 'OTHER' } });
    await tx.oAuthAccount.create({ data: { userId: user.id, provider: 'google', providerUserId: c.sub, email } });
    return user;
  });
  return u.id;
}
