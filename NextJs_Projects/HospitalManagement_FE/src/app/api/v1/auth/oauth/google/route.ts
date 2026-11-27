import { NextRequest, NextResponse } from 'next/server';
import { beginGoogleLogin } from '@/server/auth/oauth';
import { errorResponse } from '@/server/http/api';
import { getPrincipal } from '@/server/auth/session';
import { cookies } from 'next/headers';
import { env } from '@/lib/configuration/env';

/** GET /api/v1/auth/oauth/google[?link=1] - redirects to Google (authorization code + PKCE + state). `link=1` links to the signed-in account. */
export async function GET(req: NextRequest) {
  try {
    const url = await beginGoogleLogin();
    const link = req.nextUrl.searchParams.get('link') === '1' && (await getPrincipal());
    const jar = await cookies();
    if (link) jar.set('hms_oauth_link', '1', { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/', maxAge: 600 }); else jar.delete('hms_oauth_link');
    return NextResponse.redirect(url);
  } catch (e) { return errorResponse(e); }
}
