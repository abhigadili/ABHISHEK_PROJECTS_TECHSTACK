/**
 * src/app/api/auth/logout/route.ts — Logout API Route Handler
 *
 * Handles POST /api/auth/logout
 *
 * Logout is implemented as a POST (not GET) because it has a side effect:
 * deleting the auth cookie. Using GET for logout is a security anti-pattern —
 * an attacker could log a user out by embedding a <img src="/api/auth/logout">
 * on a malicious page (a CSRF logout attack). POST + sameSite cookie prevents this.
 *
 * In a real app with server-side sessions, this handler would also:
 *   1. Read the session ID from the cookie.
 *   2. Delete the session record from the database / Redis.
 *   3. Then delete the cookie from the browser.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logout, AUTH_COOKIE_NAME } from '@/lib/auth';

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  try {
    // Call the auth library's logout function.
    // For stateful sessions this is where you'd invalidate the server-side session.
    await logout();

    // Delete the auth cookie from the browser.
    // Setting maxAge to 0 (or calling .delete()) immediately expires the cookie.
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
