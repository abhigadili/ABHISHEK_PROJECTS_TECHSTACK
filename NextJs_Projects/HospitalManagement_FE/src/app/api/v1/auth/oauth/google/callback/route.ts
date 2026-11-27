import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { completeGoogleLogin } from '@/server/auth/oauth';
import { getPrincipal, startSession } from '@/server/auth/session';
import { mfaService } from '@/server/auth/mfa';
import { db } from '@/server/db';
import { audit } from '@/server/services/audit.service';
import { ROLE_HOME, type RoleKey } from '@/lib/constants/rbac';
import { AppError } from '@/server/utilities/errors';

/** GET /api/v1/auth/oauth/google/callback - provider redirects here with ?code&state. Validates state+PKCE, links/creates the user, starts the session. */
export async function GET(req: NextRequest) {
  const fail = (m: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(m)}`, req.url));
  try {
    const sp = req.nextUrl.searchParams;
    if (sp.get('error')) return fail('Google sign-in was cancelled');
    const jar = await cookies(); const linking = jar.get('hms_oauth_link')?.value === '1'; jar.delete('hms_oauth_link');
    const current = linking ? await getPrincipal() : null;
    const userId = await completeGoogleLogin(sp.get('code') ?? '', sp.get('state') ?? '', current?.userId);
    if (current) return NextResponse.redirect(new URL('/account?linked=google', req.url));
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
    if (u.status !== 'ACTIVE' || u.deletedAt) return fail('This account is not active');
    if (await mfaService.isEnabled(u.id)) return fail('This account requires MFA - sign in with your password and authenticator code');
    await startSession(u.id); await audit({ userId: u.id }, 'LOGIN_OAUTH', 'User', u.id);
    return NextResponse.redirect(new URL(ROLE_HOME[u.role.key as RoleKey], req.url));
  } catch (e) { return fail(e instanceof AppError ? e.message : 'Google sign-in failed'); }
}
